import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiHttpError, RetryableError, httpFailureOf } from "@/lib/http";
import {
   SlotExpiredError,
   StorageStalledError,
   UploadIdleError,
} from "@/lib/s3/progress-floor";
import { UPLOAD_SLOT_MAX_MS } from "@/lib/s3/upload-budget";
import { UploadTooLargeError } from "@/lib/s3/stream-upload";
import { UnconfirmedWriteError } from "@/lib/s3/conditions";
import { fakeResponse } from "@/lib/testing/fake-response";
import type { Request } from "express";
import { ErrorCode } from "@s3-viewer/shared";

const state = vi.hoisted(() => ({
   acquire: vi.fn(),
   release: vi.fn(),
}));

vi.mock("@/lib/s3/upload-budget", async (importOriginal) => ({
   ...(await importOriginal<typeof import("@/lib/s3/upload-budget")>()),
   uploadBudget: { acquire: state.acquire },
}));

import { withUploadSlot } from "./upload-slot";

type FakeRequest = EventEmitter & {
   complete: boolean;
   destroyed: boolean;
   aborted: boolean;
   setTimeout: ReturnType<typeof vi.fn>;
};
const fakes = () => {
   const req = Object.assign(new EventEmitter(), {
      complete: false,
      destroyed: false,
      aborted: false,
      setTimeout: vi.fn(),
   }) as FakeRequest;
   const res = fakeResponse();
   return { req: req as unknown as Request, res, raw: { req, res } };
};

const options = { userId: "user1", reservation: 1024 };

describe("withUploadSlot", () => {
   it.each(["response", "request", "aborted request", "controller"])(
      "does not admit storage work after an earlier %s cancellation",
      async (source) => {
         state.acquire.mockReset().mockReturnValue(state.release);
         state.release.mockReset();
         const { req, res, raw } = fakes();
         const abortController = new AbortController();
         if (source === "response") raw.res.destroyed = true;
         if (source === "request") raw.req.destroyed = true;
         if (source === "aborted request") raw.req.aborted = true;
         if (source === "controller") abortController.abort();
         const run = vi.fn();
         await expect(
            withUploadSlot(req, res, { ...options, abortController }, run)
         ).rejects.toBeInstanceOf(Error);
         expect(run).not.toHaveBeenCalled();
         expect(state.acquire).not.toHaveBeenCalled();
         expect(state.release).not.toHaveBeenCalled();
         expect(raw.req.listenerCount("close")).toBe(0);
         expect(raw.res.listenerCount("close")).toBe(0);
      }
   );

   it("allows a completed request body and still cancels on response disconnect", async () => {
      state.acquire.mockReset().mockReturnValue(state.release);
      state.release.mockReset();
      const { req, res, raw } = fakes();
      raw.req.complete = true;
      raw.req.destroyed = true;
      await expect(
         withUploadSlot(req, res, options, async (controller) => {
            expect(controller.signal.aborted).toBe(false);
            raw.res.emit("close");
            expect(controller.signal.aborted).toBe(true);
            return "done";
         })
      ).resolves.toBe("done");
      expect(raw.res.headers).toEqual({});
      expect(state.release).toHaveBeenCalledOnce();
   });

   it("marks only admission refusals as a transfer that never started", async () => {
      const { req, res } = fakes();
      const transferOptions = {
         ...options,
         admissionErrorCode: ErrorCode.TRANSFER_NOT_STARTED,
      };
      state.acquire.mockReset().mockImplementation(() => {
         throw new ApiHttpError(429, "busy", ErrorCode.RATE_LIMITED);
      });
      const run = vi.fn();
      await expect(
         withUploadSlot(req, res, transferOptions, run)
      ).rejects.toMatchObject({
         status: 429,
         code: ErrorCode.TRANSFER_NOT_STARTED,
      });
      expect(run).not.toHaveBeenCalled();

      state.acquire.mockReset().mockReturnValue(state.release);
      const failure = new ApiHttpError(
         429,
         "response capacity",
         ErrorCode.RATE_LIMITED
      );
      await expect(
         withUploadSlot(req, res, transferOptions, async () => {
            throw failure;
         })
      ).rejects.toMatchObject({ status: 429, code: ErrorCode.RATE_LIMITED });
   });
   it("answers a refused reservation with a closing 429 and a retry hint", async () => {
      state.acquire.mockReset().mockImplementation(() => {
         throw new ApiHttpError(429, "busy");
      });
      const { req, res, raw } = fakes();
      const run = vi.fn();
      await expect(
         withUploadSlot(req, res, options, run)
      ).rejects.toMatchObject({ status: 429 });
      expect(raw.res.headers).toEqual({
         Connection: "close",
         "Retry-After": "5",
      });
      expect(run).not.toHaveBeenCalled();
   });

   it("releases exactly once and maps the streaming failures", async () => {
      const cases: [Error, number][] = [
         [new UploadIdleError(), 408],
         [new StorageStalledError(), 504],
         [new UploadTooLargeError(10), 413],
         [new ApiHttpError(409, "conflict"), 409],
      ];
      for (const [failure, status] of cases) {
         state.acquire.mockReset().mockReturnValue(state.release);
         state.release.mockReset();
         const { req, res, raw } = fakes();
         const answered = await withUploadSlot(req, res, options, async () => {
            throw failure;
         }).then(
            () => undefined,
            (error: unknown) => httpFailureOf(error)
         );
         expect(answered).toMatchObject({ status, message: failure.message });
         expect(raw.res.headers).toEqual({ Connection: "close" });
         expect(state.release).toHaveBeenCalledOnce();
         expect(raw.req.setTimeout).toHaveBeenCalledWith(0);
         expect(raw.req.listenerCount("close")).toBe(0);
         expect(raw.res.listenerCount("close")).toBe(0);
      }
   });

   it("hands a retryable failure on untouched", async () => {
      const cases = [
         new RetryableError("Database pool timeout"),
         Object.assign(new Error("timed out fetching a connection"), {
            code: "P2024",
         }),
      ];
      for (const failure of cases) {
         state.acquire.mockReset().mockReturnValue(state.release);
         state.release.mockReset();
         const { req, res, raw } = fakes();
         await expect(
            withUploadSlot(req, res, options, async () => {
               throw failure;
            })
         ).rejects.toBe(failure);
         expect(raw.res.headers).toEqual({ Connection: "close" });
         expect(state.release).toHaveBeenCalledOnce();
      }
   });

   it("keeps the real failure when the headers were already flushed", async () => {
      state.acquire.mockReset().mockReturnValue(state.release);
      state.release.mockReset();
      const { req, res, raw } = fakes();
      await expect(
         withUploadSlot(req, res, options, async () => {
            raw.res.headersSent = true;
            throw new StorageStalledError();
         })
      ).rejects.toMatchObject({ status: 504 });
      expect(raw.res.headers).toEqual({});
      expect(state.release).toHaveBeenCalledOnce();
   });

   it("leaves the socket alone for a route that reads no body", async () => {
      state.acquire.mockReset().mockReturnValue(state.release);
      state.release.mockReset();
      const { req, res, raw } = fakes();
      await expect(
         withUploadSlot(
            req,
            res,
            { ...options, closeOnFailure: false },
            async () => {
               throw new UploadIdleError();
            }
         )
      ).rejects.toMatchObject({ status: 408 });
      expect(raw.res.headers).toEqual({});
      expect(state.release).toHaveBeenCalledOnce();
   });

   it("aborts the run when the client goes away and still releases", async () => {
      state.acquire.mockReset().mockReturnValue(state.release);
      state.release.mockReset();
      const { req, res, raw } = fakes();
      let seen: AbortSignal | undefined;
      const pending = withUploadSlot(req, res, options, (controller) => {
         seen = controller.signal;
         return new Promise<never>((_resolve, reject) =>
            controller.signal.addEventListener("abort", () =>
               reject(new ApiHttpError(499, "gone"))
            )
         );
      });
      raw.res.emit("close");
      await expect(pending).rejects.toMatchObject({ status: 499 });
      expect(seen?.aborted).toBe(true);
      expect(state.release).toHaveBeenCalledOnce();
   });

   describe("lifetime", () => {
      afterEach(() => {
         vi.useRealTimers();
      });

      const hang = (controller: AbortController) =>
         new Promise<never>((_resolve, reject) =>
            controller.signal.addEventListener("abort", () =>
               reject(new Error("storage request aborted"))
            )
         );

      it("aborts a slot held past its declared size's lifetime and answers 408", async () => {
         vi.useFakeTimers();
         state.acquire.mockReset().mockReturnValue(state.release);
         state.release.mockReset();
         const { req, res, raw } = fakes();
         let seen: AbortSignal | undefined;
         const pending = withUploadSlot(
            req,
            res,
            { ...options, bytes: 1024 },
            (controller) => {
               seen = controller.signal;
               return hang(controller);
            }
         );
         const rejected = expect(pending).rejects.toMatchObject({
            status: 408,
            message: new SlotExpiredError().message,
         });
         await vi.advanceTimersByTimeAsync(10 * 60_000 - 1);
         expect(seen?.aborted).toBe(false);
         await vi.advanceTimersByTimeAsync(1);
         await rejected;
         expect(seen?.reason).toBeInstanceOf(SlotExpiredError);
         expect(raw.res.headers).toEqual({ Connection: "close" });
         expect(state.release).toHaveBeenCalledOnce();
      });

      it("passes an unconfirmed commit through when the expiry cut its answer off", async () => {
         vi.useFakeTimers();
         state.acquire.mockReset().mockReturnValue(state.release);
         state.release.mockReset();
         const { req, res } = fakes();
         const unconfirmed = new UnconfirmedWriteError();
         let seen: AbortSignal | undefined;
         const pending = withUploadSlot(
            req,
            res,
            { ...options, bytes: 1024 },
            (controller) => {
               seen = controller.signal;
               return new Promise<never>((_resolve, reject) =>
                  controller.signal.addEventListener("abort", () =>
                     reject(unconfirmed)
                  )
               );
            }
         );
         const rejected = expect(pending).rejects.toBe(unconfirmed);
         await vi.advanceTimersByTimeAsync(10 * 60_000);
         await rejected;
         expect(seen?.reason).toBeInstanceOf(SlotExpiredError);
         expect(state.release).toHaveBeenCalledOnce();
      });

      it("caps a slot of undeclared size", async () => {
         vi.useFakeTimers();
         state.acquire.mockReset().mockReturnValue(state.release);
         const { req, res } = fakes();
         let seen: AbortSignal | undefined;
         const pending = withUploadSlot(req, res, options, (controller) => {
            seen = controller.signal;
            return hang(controller);
         });
         const rejected = expect(pending).rejects.toMatchObject({
            status: 408,
         });
         await vi.advanceTimersByTimeAsync(UPLOAD_SLOT_MAX_MS - 1);
         expect(seen?.aborted).toBe(false);
         await vi.advanceTimersByTimeAsync(1);
         await rejected;
      });

      it("leaves no timer behind once the run settles", async () => {
         vi.useFakeTimers();
         state.acquire.mockReset().mockReturnValue(state.release);
         const { req, res } = fakes();
         await expect(
            withUploadSlot(req, res, options, async () => "done")
         ).resolves.toBe("done");
         expect(vi.getTimerCount()).toBe(0);
      });
   });

   it("admits by the caller's address, grouping IPv6 by prefix", async () => {
      state.acquire.mockReset().mockReturnValue(state.release);
      for (const [ip, key] of [
         ["198.51.100.7", "198.51.100.7"],
         ["2001:db8:aa:bb00::1", "2001:db8:aa:bb00::/56"],
         [undefined, ""],
      ] as const) {
         state.acquire.mockClear();
         const { req, res } = fakes();
         Object.assign(req, { ip });
         await withUploadSlot(req, res, options, async () => "done");
         expect(state.acquire).toHaveBeenCalledWith(
            "user1",
            1024,
            undefined,
            key,
            undefined
         );
      }
   });

   it("admits by the server the authorize gate chose", async () => {
      state.acquire.mockReset().mockReturnValue(state.release);
      const { req, res } = fakes();
      Object.assign(res.locals, { auth: { serverId: "server-a" } });
      await withUploadSlot(req, res, options, async () => "done");
      expect(state.acquire.mock.calls[0]?.[4]).toBe("server-a");
   });
});
