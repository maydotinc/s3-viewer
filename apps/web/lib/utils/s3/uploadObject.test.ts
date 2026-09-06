import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UploadCancelled } from "./upload-cancelled";

const identity = vi.hoisted(() => ({ userId: "user-a" as string | null }));
vi.mock("@/lib/stores/sessionStore", () => ({
   default: { getState: () => identity },
}));

type ProgressHandler = (event: {
   loaded: number;
   lengthComputable: boolean;
}) => void;

class FakeXHR {
   static readonly DONE = 4;
   static instances: FakeXHR[] = [];

   readyState = 0;
   status = 0;
   responseText = "";
   timeout = 0;
   withCredentials = false;
   upload: { onprogress: ProgressHandler | null } = { onprogress: null };
   onload: (() => void) | null = null;
   onerror: (() => void) | null = null;
   onabort: (() => void) | null = null;
   ontimeout: (() => void) | null = null;
   method = "";
   url = "";
   headers: Record<string, string> = {};

   constructor() {
      FakeXHR.instances.push(this);
   }

   open(method: string, url: string) {
      this.method = method;
      this.url = url;
   }

   setRequestHeader(key: string, value: string) {
      this.headers[key] = value;
   }

   send() {
      this.readyState = 1;
   }

   abort() {
      this.readyState = FakeXHR.DONE;
      this.onabort?.();
   }

   progress(loaded: number) {
      this.upload.onprogress?.({ loaded, lengthComputable: true });
   }

   respond(status: number, body: unknown) {
      this.status = status;
      this.responseText = JSON.stringify(body);
      this.readyState = FakeXHR.DONE;
      this.onload?.();
   }

   fail() {
      this.readyState = FakeXHR.DONE;
      this.onerror?.();
   }

   timeoutOut() {
      this.readyState = FakeXHR.DONE;
      this.ontimeout?.();
   }
}

vi.stubGlobal("XMLHttpRequest", FakeXHR);

const { uploadObject } = await import("./uploadObject");
const { setUnauthorizedHandler } = await import("@/lib/api");

const body = { key: "k", size: 10, eTag: "e" };
const makeFile = (size = 10) => new File(["x".repeat(size)], "a.txt");

const upload = (overrides: { file?: File; expectedETag?: string } = {}) =>
   uploadObject({
      userId: "user-a",
      serverId: "s",
      bucketName: "b",
      objectKey: "k",
      file: overrides.file ?? makeFile(),
      contentType: "text/plain",
      expectedETag: overrides.expectedETag,
      onProgress: vi.fn(),
   });

beforeEach(() => {
   identity.userId = "user-a";
   FakeXHR.instances = [];
   vi.useFakeTimers();
});

afterEach(() => {
   setUnauthorizedHandler(() => {});
   vi.useRealTimers();
});

describe("uploadObject", () => {
   it("reports a same-user upload 401 but ignores a delayed 401 after the account changes", async () => {
      const unauthorized = vi.fn();
      setUnauthorizedHandler(unauthorized);
      const first = upload();
      FakeXHR.instances[0]?.respond(401, { message: "Sign in required" });
      await expect(first.done).rejects.toMatchObject({ status: 401 });
      expect(unauthorized).toHaveBeenCalledOnce();
      const previous = upload();
      identity.userId = "user-b";
      FakeXHR.instances[1]?.respond(401, { message: "Sign in required" });
      await expect(previous.done).rejects.toMatchObject({ status: 401 });
      expect(unauthorized).toHaveBeenCalledOnce();
   });

   it("sends the captured user identity to the API on every retry", async () => {
      const handle = upload();
      const firstUrl = FakeXHR.instances[0]?.url ?? "";
      expect(
         new URL(firstUrl, "http://localhost").searchParams.get(
            "expectedUserId"
         )
      ).toBe("user-a");
      FakeXHR.instances[0]?.fail();
      await vi.advanceTimersByTimeAsync(500);
      expect(FakeXHR.instances[1]?.url).toBe(firstUrl);
      FakeXHR.instances[1]?.respond(201, body);
      await expect(handle.done).resolves.toEqual(body);
   });

   it.each([null, "user-b"])(
      "refuses an upload under changed identity %s before sending bytes",
      async (userId) => {
         identity.userId = userId;
         const handle = upload();
         await expect(handle.done).rejects.toBeInstanceOf(UploadCancelled);
         expect(FakeXHR.instances).toHaveLength(0);
      }
   );

   it.each([null, "user-b"])(
      "cancels a network retry when identity becomes %s",
      async (userId) => {
         const handle = upload();
         const result = expect(handle.done).rejects.toBeInstanceOf(
            UploadCancelled
         );
         FakeXHR.instances[0]?.fail();
         identity.userId = userId;
         await vi.advanceTimersByTimeAsync(500);
         await result;
         expect(FakeXHR.instances).toHaveLength(1);
      }
   );

   it.each(["fail", "timeoutOut"] as const)(
      "never replays an overwrite after an ambiguous %s response",
      async (failure) => {
         const handle = upload({ expectedETag: '"before-confirmation"' });
         const rejected = expect(handle.done).rejects.toMatchObject({
            status: 0,
            code: "UPLOAD_OUTCOME_UNKNOWN",
            message: expect.stringContaining("Refresh the folder"),
         });
         const firstUrl = FakeXHR.instances[0]?.url ?? "";
         expect(new URL(firstUrl, "http://localhost").pathname).toBe(
            "/servers/s/buckets/b/objects/v3/upload"
         );
         expect(
            new URL(firstUrl, "http://localhost").searchParams.get(
               "expectedETag"
            )
         ).toBe('"before-confirmation"');
         FakeXHR.instances[0]?.[failure]();
         await rejected;
         await vi.advanceTimersByTimeAsync(5000);
         expect(FakeXHR.instances).toHaveLength(1);
      }
   );

   it("does not send replacement authority for a new file", async () => {
      const handle = upload();
      expect(
         new URL(
            FakeXHR.instances[0]?.url ?? "",
            "http://localhost"
         ).searchParams.has("expectedETag")
      ).toBe(false);
      FakeXHR.instances[0]?.respond(201, body);
      await expect(handle.done).resolves.toEqual(body);
   });

   it("resolves with the parsed body and reports progress up to the full size", async () => {
      const onProgress = vi.fn();
      const handle = uploadObject({
         userId: "user-a",
         serverId: "s",
         bucketName: "b",
         objectKey: "k",
         file: makeFile(),
         contentType: "text/plain",
         onProgress,
      });
      const xhr = FakeXHR.instances[0];
      if (!xhr) throw new Error("no xhr");
      xhr.progress(5);
      xhr.respond(201, body);
      await expect(handle.done).resolves.toEqual(body);
      expect(onProgress).toHaveBeenCalledWith(5);
      expect(onProgress).toHaveBeenCalledWith(10);
   });

   it("sets a positive client-side timeout before sending", () => {
      upload({ file: makeFile(10) });
      expect(FakeXHR.instances[0]?.timeout).toBeGreaterThan(0);
   });

   it("retries a new-file status-0 network error with exponential backoff, up to two retries", async () => {
      const handle = upload();
      FakeXHR.instances[0]?.fail();
      await vi.advanceTimersByTimeAsync(500);
      expect(FakeXHR.instances).toHaveLength(2);

      FakeXHR.instances[1]?.fail();
      await vi.advanceTimersByTimeAsync(999);
      expect(FakeXHR.instances).toHaveLength(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(FakeXHR.instances).toHaveLength(3);

      FakeXHR.instances[2]?.respond(200, body);
      await expect(handle.done).resolves.toEqual(body);
   });

   it("stops retrying once the retry bound is exhausted", async () => {
      const handle = upload();
      FakeXHR.instances[0]?.fail();
      await vi.advanceTimersByTimeAsync(500);
      FakeXHR.instances[1]?.fail();
      await vi.advanceTimersByTimeAsync(1000);
      FakeXHR.instances[2]?.fail();

      await expect(handle.done).rejects.toMatchObject({
         status: 0,
         code: "UPLOAD_OUTCOME_UNKNOWN",
      });
      expect(FakeXHR.instances).toHaveLength(3);
   });

   it("treats a new-file client-side timeout as a retryable network error", async () => {
      const handle = upload();
      FakeXHR.instances[0]?.timeoutOut();
      await vi.advanceTimersByTimeAsync(500);
      expect(FakeXHR.instances).toHaveLength(2);
      FakeXHR.instances[1]?.respond(200, body);
      await expect(handle.done).resolves.toEqual(body);
   });

   it("rejects instead of hanging when a 2xx body can't be parsed", async () => {
      const handle = upload();
      const xhr = FakeXHR.instances[0];
      if (!xhr) throw new Error("no xhr");
      xhr.status = 200;
      xhr.responseText = "<!doctype html>";
      xhr.readyState = FakeXHR.DONE;
      xhr.onload?.();
      await expect(handle.done).rejects.toMatchObject({ status: 200 });
      expect(FakeXHR.instances).toHaveLength(1);
   });

   it("never retries a 4xx or 5xx response", async () => {
      const serverError = upload();
      FakeXHR.instances[0]?.respond(500, { message: "boom" });
      await expect(serverError.done).rejects.toMatchObject({ status: 500 });
      expect(FakeXHR.instances).toHaveLength(1);

      const clientError = upload();
      FakeXHR.instances[1]?.respond(404, { message: "missing" });
      await expect(clientError.done).rejects.toMatchObject({ status: 404 });
      expect(FakeXHR.instances).toHaveLength(2);
   });

   it("aborting mid-flight rejects with UploadCancelled and aborts the request", async () => {
      const handle = upload();
      const xhr = FakeXHR.instances[0];
      if (!xhr) throw new Error("no xhr");
      const abortSpy = vi.spyOn(xhr, "abort");
      handle.abort();
      await expect(handle.done).rejects.toBeInstanceOf(UploadCancelled);
      expect(abortSpy).toHaveBeenCalledOnce();
   });

   it("aborting during backoff cancels immediately instead of waiting out the delay", async () => {
      const handle = upload();
      FakeXHR.instances[0]?.fail();
      handle.abort();
      await expect(handle.done).rejects.toBeInstanceOf(UploadCancelled);
      expect(FakeXHR.instances).toHaveLength(1);
   });
});
