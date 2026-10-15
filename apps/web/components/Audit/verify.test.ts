// @vitest-environment happy-dom
import { mountedRuntime } from "@/components/test-helpers";
import { deferred, flushRuntime } from "@/lib/test/runtime";
import type { AuditVerification } from "@s3-viewer/types";
import { act, createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VerifyButton from "./verify";

const h = vi.hoisted(() => ({
   session: { userId: "user-a", serverId: "server-a" },
   get: vi.fn(),
   success: vi.fn(),
   error: vi.fn(),
}));
vi.mock("@/lib/stores/session-store", () => ({
   default: { getState: () => h.session },
   useUserId: () => h.session.userId,
}));
vi.mock("@/lib/api", async (original) => ({
   ...(await original<typeof import("@/lib/api")>()),
   api: { get: h.get },
}));
vi.mock("@s3-viewer/ui/components/toast", async () =>
   (await import("@/components/test-helpers")).toastMock({
      success: h.success,
      error: h.error,
   })
);

const view = mountedRuntime();
const button = () => view.current.container.querySelector("button")!;
const click = async () => {
   await act(async () => button().click());
   await flushRuntime();
};
const message = () =>
   view.current.container.querySelector('p[role="status"]')?.textContent;
const partial: AuditVerification = {
   ok: true,
   rows: 100_000,
   firstSeq: 1,
   lastSeq: 100_000,
   brokenAt: null,
   truncated: false,
   anchorSeq: null,
   nextFromSeq: 100_000,
};
const complete: AuditVerification = {
   ...partial,
   rows: 1,
   firstSeq: 100_001,
   lastSeq: 100_001,
   anchorSeq: 100_001,
   nextFromSeq: null,
};

beforeEach(async () => {
   vi.resetAllMocks();
   h.session = { userId: "user-a", serverId: "server-a" };
   await view.mount(
      createElement(VerifyButton, { serverId: "server-a", disabled: false })
   );
});

describe("bounded integrity verification", () => {
   it("reports a partial check and finds corruption beyond the first window", async () => {
      h.get.mockResolvedValueOnce(partial).mockResolvedValueOnce({
         ...complete,
         ok: false,
         brokenAt: 100_001,
      });
      await click();
      expect(message()).toContain("100,000 records so far");
      expect(message()).not.toContain("Chain intact");
      expect(button().textContent).toContain("Continue verification");
      expect(h.get).toHaveBeenCalledTimes(1);
      expect(h.success).not.toHaveBeenCalled();

      await click();
      expect(h.get).toHaveBeenLastCalledWith(
         "/servers/server-a/audit/verify?fromSeq=100000",
         expect.any(AbortSignal)
      );
      expect(message()).toBe("Chain broken at record #100,001");
      expect(h.error).toHaveBeenCalledWith(message());
      expect(h.success).not.toHaveBeenCalled();
   });

   it("reports the combined checked range only after the final window", async () => {
      h.get.mockResolvedValueOnce(partial).mockResolvedValueOnce(complete);
      await click();
      await click();
      expect(message()).toBe("Chain intact: 100,001 records (#1–#100,001)");
      expect(h.success).toHaveBeenCalledOnce();
      expect(h.success).toHaveBeenCalledWith(message());
      expect(button().textContent).toContain("Verify integrity");
   });

   it("keeps an unsuccessful continuation retryable without reporting completion", async () => {
      h.get
         .mockResolvedValueOnce(partial)
         .mockRejectedValueOnce(new Error("Storage unavailable"));
      await click();
      await click();
      expect(h.error).toHaveBeenCalledWith("Storage unavailable");
      expect(message()).toContain("records so far");
      expect(button().textContent).toContain("Continue verification");
      expect(h.success).not.toHaveBeenCalled();
   });

   it("keeps the checked count when retention removes the remaining records", async () => {
      h.get.mockResolvedValueOnce(partial).mockResolvedValueOnce({
         ...complete,
         rows: 0,
         firstSeq: null,
         lastSeq: null,
      });
      await click();
      await click();
      expect(message()).toBe("Chain intact: 100,000 records (#1–#100,000)");
      expect(h.success).toHaveBeenCalledWith(message());
   });

   it("removes an earlier all-clear while checking again", async () => {
      h.get
         .mockResolvedValueOnce(complete)
         .mockReturnValueOnce(deferred<AuditVerification>().promise);
      await click();
      await click();
      expect(button().getAttribute("aria-busy")).toBe("true");
      expect(button().disabled).toBe(true);
      expect(message()).toBeUndefined();
      expect(h.success).toHaveBeenCalledOnce();
   });

   it("refuses a repeated continuation cursor", async () => {
      h.get.mockResolvedValue(partial);
      await click();
      await click();
      expect(h.error).toHaveBeenCalledWith(
         "Verification did not advance. Try again."
      );
      expect(h.get).toHaveBeenCalledTimes(2);
      expect(h.success).not.toHaveBeenCalled();
   });

   it.each(["userId", "serverId"] as const)(
      "ignores results and further clicks after %s changes",
      async (field) => {
         const response = deferred<AuditVerification>();
         h.get.mockReturnValue(response.promise);
         await click();
         h.session = { ...h.session, [field]: "changed" };
         await act(async () => response.resolve(complete));
         await flushRuntime();
         await click();
         expect(h.get).toHaveBeenCalledTimes(1);
         expect(h.success).not.toHaveBeenCalled();
         expect(h.error).not.toHaveBeenCalled();
         expect(message()).toBeUndefined();
      }
   );

   it("cancels on unmount and prevents duplicate requests while pending", async () => {
      const response = deferred<AuditVerification>();
      h.get.mockReturnValue(response.promise);
      await click();
      await click();
      expect(h.get).toHaveBeenCalledTimes(1);
      const signal = h.get.mock.calls[0]![1] as AbortSignal;
      await view.current.unmount();
      expect(signal.aborted).toBe(true);
      response.resolve(complete);
      await flushRuntime();
      expect(h.success).not.toHaveBeenCalled();
      expect(h.error).not.toHaveBeenCalled();
   });
});
