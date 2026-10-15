import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadFromStorage, downloadUrl, saveBlob } from "./download";

const h = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("@s3-viewer/ui/components/toast", () => ({
   toast: { error: h.error },
}));

afterEach(() => {
   vi.useRealTimers();
   vi.unstubAllGlobals();
   vi.clearAllMocks();
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

describe("downloadFromStorage", () => {
   const URL_ = "https://storage.test/report.pdf?X-Amz-Signature=sig";

   const stubFrame = () => {
      let onLoad: (() => void) | undefined;
      const frame = {
         hidden: false,
         src: "",
         attributes: {} as Record<string, string>,
         setAttribute(name: string, value: string) {
            this.attributes[name] = value;
         },
         addEventListener: vi.fn((type: string, listener: () => void) => {
            if (type === "load") onLoad = listener;
         }),
         remove: vi.fn(),
      };
      const appendChild = vi.fn();
      vi.stubGlobal("document", {
         createElement: (tag: string) => {
            expect(tag).toBe("iframe");
            return frame;
         },
         body: { appendChild },
      });
      return { frame, appendChild, load: () => onLoad?.() };
   };

   it("starts the download in a hidden, script-free frame so the app tab stays put", () => {
      const { frame, appendChild } = stubFrame();
      downloadFromStorage(URL_);
      expect(frame.src).toBe(URL_);
      expect(frame.hidden).toBe(true);
      expect(frame.attributes.sandbox).toBe("allow-downloads");
      expect(appendChild).toHaveBeenCalledWith(frame);
      expect(h.error).not.toHaveBeenCalled();
   });

   it("removes the frame once the download has had time to start", () => {
      vi.useFakeTimers();
      const { frame } = stubFrame();
      downloadFromStorage(URL_);
      expect(frame.remove).not.toHaveBeenCalled();
      vi.advanceTimersByTime(60_000);
      expect(frame.remove).toHaveBeenCalledOnce();
   });

   it("says so, and offers the link, when storage renders a page instead", () => {
      const open = vi.fn();
      vi.stubGlobal("window", { open });
      const { frame, load } = stubFrame();
      downloadFromStorage(URL_);
      load();
      expect(frame.remove).toHaveBeenCalledOnce();
      expect(h.error).toHaveBeenCalledOnce();
      const [title, options] = h.error.mock.calls[0] as [
         string,
         { action: { onClick: () => void } },
      ];
      expect(title).toBe("The download didn't start");
      options.action.onClick();
      expect(open).toHaveBeenCalledWith(URL_, "_blank", "noopener,noreferrer");
   });
});
