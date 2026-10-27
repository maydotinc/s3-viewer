import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({
   Toaster: () => null,
   toast: Object.assign(vi.fn(), h),
}));

const { DESCRIBED_ERROR_MS, toast } = await import("./toast");

beforeEach(() => vi.clearAllMocks());

describe("toast", () => {
   it("keeps described errors up long enough to read", () => {
      toast.error("2 files failed", { description: "a.txt, b.txt" });
      expect(h.error).toHaveBeenCalledWith("2 files failed", {
         description: "a.txt, b.txt",
         duration: DESCRIBED_ERROR_MS,
      });
   });

   it("leaves one-line errors, explicit durations and other kinds alone", () => {
      toast.error("Failed");
      toast.error("Failed", { description: "why", duration: 1000 });
      toast.success("Saved", { description: "all good" });
      expect(h.error.mock.calls).toEqual([
         ["Failed", undefined],
         ["Failed", { description: "why", duration: 1000 }],
      ]);
      expect(h.success).toHaveBeenCalledWith("Saved", {
         description: "all good",
      });
   });
});
