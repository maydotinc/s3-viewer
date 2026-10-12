import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadUrl, saveBlob } from "./download";

afterEach(() => {
   vi.useRealTimers();
   vi.unstubAllGlobals();
});

describe("downloadUrl", () => {
   it("clicks a hidden anchor and cleans it up", () => {
      const click = vi.fn();
      const anchor = { rel: "", href: "", style: {}, click, remove: vi.fn() };
      const appendChild = vi.fn();
      vi.stubGlobal("document", {
         createElement: () => anchor,
         body: { appendChild },
      });
      downloadUrl("https://api.example.test/zip");
      expect(anchor.href).toBe("https://api.example.test/zip");
      expect(anchor.rel).toBe("noopener");
      expect(appendChild).toHaveBeenCalledWith(anchor);
      expect(click).toHaveBeenCalledOnce();
      expect(anchor.remove).toHaveBeenCalledOnce();
   });

   it("names the file when asked", () => {
      const anchor = {
         rel: "",
         href: "",
         download: "",
         style: {},
         click: vi.fn(),
         remove: vi.fn(),
      };
      vi.stubGlobal("document", {
         createElement: () => anchor,
         body: { appendChild: vi.fn() },
      });
      downloadUrl("https://api.example.test/file", "report.pdf");
      expect(anchor.download).toBe("report.pdf");
   });
});

describe("saveBlob", () => {
   const stubDownload = () => {
      const anchor = {
         rel: "",
         href: "",
         download: "",
         style: {},
         click: vi.fn(),
         remove: vi.fn(),
      };
      const revoke = vi.fn();
      vi.stubGlobal("document", {
         createElement: () => anchor,
         body: { appendChild: vi.fn() },
      });
      vi.stubGlobal("URL", {
         createObjectURL: () => "blob:audit",
         revokeObjectURL: revoke,
      });
      return { anchor, revoke };
   };

   it("downloads the blob under the given name", () => {
      const { anchor } = stubDownload();
      saveBlob("audit.csv", new Blob(["a,b"]));
      expect(anchor.href).toBe("blob:audit");
      expect(anchor.download).toBe("audit.csv");
      expect(anchor.click).toHaveBeenCalledOnce();
   });

   it("keeps the blob URL alive while the browser starts the download", () => {
      vi.useFakeTimers();
      const { revoke } = stubDownload();
      saveBlob("audit.csv", new Blob(["a,b"]));
      expect(revoke).not.toHaveBeenCalled();
      vi.advanceTimersByTime(60_000);
      expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:audit");
   });
});
