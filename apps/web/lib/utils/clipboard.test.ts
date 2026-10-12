import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyToClipboard } from "./clipboard";

const h = vi.hoisted(() => ({
   success: vi.fn(),
   error: vi.fn(),
   writeText: vi.fn<(text: string) => Promise<void>>(),
}));

vi.mock("@s3-viewer/ui/components/toast", () => ({
   toast: { success: h.success, error: h.error },
}));
vi.mock("@/lib/api", () => ({ errorMessage: String }));

beforeEach(() => {
   vi.clearAllMocks();
   vi.stubGlobal("navigator", { clipboard: { writeText: h.writeText } });
});
afterEach(() => vi.unstubAllGlobals());

describe("copying text to the clipboard", () => {
   it("confirms a copy with the success toast when one is given", async () => {
      h.writeText.mockResolvedValue();
      await expect(
         copyToClipboard("abc", { success: "Copied.", failure: "No" })
      ).resolves.toBe(true);
      expect(h.writeText).toHaveBeenCalledExactlyOnceWith("abc");
      expect(h.success).toHaveBeenCalledExactlyOnceWith("Copied.");
      expect(h.error).not.toHaveBeenCalled();
   });

   it("stays quiet on success without a success message", async () => {
      h.writeText.mockResolvedValue();
      await expect(copyToClipboard("abc", { failure: "No" })).resolves.toBe(
         true
      );
      expect(h.success).not.toHaveBeenCalled();
   });

   it("reports a refused copy with the failure title and the cause", async () => {
      h.writeText.mockRejectedValue(new Error("Denied"));
      await expect(
         copyToClipboard("abc", {
            success: "Copied.",
            failure: "Couldn't copy",
         })
      ).resolves.toBe(false);
      expect(h.success).not.toHaveBeenCalled();
      expect(h.error).toHaveBeenCalledExactlyOnceWith("Couldn't copy", {
         description: "Error: Denied",
      });
   });
});
