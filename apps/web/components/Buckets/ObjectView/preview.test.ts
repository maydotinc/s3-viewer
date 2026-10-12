// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"navigation":{"disableChildFrameNavigation":true}}}
import { act, createElement, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountedRuntime } from "@/components/test-helpers";
import type { S3ObjectPreview } from "@s3-viewer/types";
import { deferred } from "@/lib/test/runtime";
import ObjectPreview from "./preview";

const h = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("./preview-message", () => ({
   PreviewMessage: ({ title, text }: { title: string; text?: string }) =>
      createElement("p", null, [title, text].filter(Boolean).join(". ")),
}));
vi.mock("@/components/Buckets/Context", () => ({
   useBucketContext: () => ({ bucketName: "bucket" }),
}));
vi.mock("@/lib/hooks/queries/s3/useObjectBody", () => ({
   default: () => ({ data: undefined, isPending: false, isError: true }),
   ObjectBodyError: class extends Error {},
}));

const initialPreview = (contentType = "video/mp4"): S3ObjectPreview => ({
   url: "https://storage.test/file?signature=one",
   expiresAt: new Date(Date.now() + 900_000).toISOString(),
   contentType,
   contentLength: 1000,
   eTag: '"one"',
   versionId: null,
   lastModified: "2026-09-01T00:00:00Z",
   contentEncoding: null,
   cacheControl: null,
   contentDisposition: null,
   contentLanguage: null,
   expires: null,
   metadata: {},
   serverSideEncryption: null,
   sseKmsKeyId: null,
   storageClass: null,
});

type Props = {
   preview: S3ObjectPreview;
   objectKey: string;
   fileName: string;
   isError: boolean;
};
const view = mountedRuntime(() => {
   vi.restoreAllMocks();
   vi.unstubAllGlobals();
});
let update!: (change: Partial<Props>) => void;
const Probe = ({ preview }: { preview: S3ObjectPreview }) => {
   const [props, setProps] = useState<Props>({
      preview,
      objectKey: "file",
      fileName: "file",
      isError: false,
   });
   update = (change) => setProps((previous) => ({ ...previous, ...change }));
   return createElement(ObjectPreview, {
      ...props,
      isLoading: false,
      refreshPreview: h.refresh,
   });
};
const mount = async (preview = initialPreview()) => {
   await view.mount(createElement(Probe, { preview }));
};
const mediaElement = () =>
   view.current.container.querySelector("video, audio")! as HTMLMediaElement;
const change = async (props: Partial<Props>) => act(async () => update(props));
const emit = async (element: Element, event: string) =>
   act(async () => {
      element.dispatchEvent(new Event(event));
   });

beforeEach(() => {
   vi.clearAllMocks();
   vi.stubGlobal(
      "HTMLMediaElement",
      class extends HTMLMediaElement {
         static readonly HAVE_FUTURE_DATA = 3;
      }
   );
});

describe("empty files", () => {
   it.each(["video/mp4", "image/png", "application/json", "text/plain"])(
      "says a zero-byte %s is empty instead of loading a source that can only fail",
      async (contentType) => {
         await mount({ ...initialPreview(contentType), contentLength: 0 });
         expect(view.current.container.textContent).toBe("This file is empty");
         expect(
            view.current.container.querySelector("video, img, iframe")
         ).toBeNull();
         expect(h.refresh).not.toHaveBeenCalled();
      }
   );
});

describe("large files", () => {
   const huge = 2 * 1024 ** 3;

   it.each([
      ["video/mp4", "video"],
      ["audio/mpeg", "audio"],
      ["application/pdf", "iframe"],
   ])("streams a large %s instead of refusing it", async (type, element) => {
      await mount({ ...initialPreview(type), contentLength: huge });
      expect(view.current.container.querySelector(element)).not.toBeNull();
   });

   it.each(["image/png", "text/plain"])(
      "asks to download a large %s",
      async (contentType) => {
         await mount({ ...initialPreview(contentType), contentLength: huge });
         expect(view.current.container.textContent).toContain("Too large");
         expect(view.current.container.querySelector("img, iframe")).toBeNull();
      }
   );
});

describe("video layout", () => {
   it("fills a reserved aspect box so the player does not resize when metadata arrives", async () => {
      await mount();
      const video = mediaElement();
      expect(video.className).toContain("absolute inset-0 size-full");
      expect(video.parentElement!.className).toContain("aspect-[4/3]");
   });
});

describe("authorized preview renewal", () => {
   it.each(["video/mp4", "audio/mpeg"])(
      "preserves active %s playback when only its signature changes",
      async (type) => {
         const preview = initialPreview(type);
         await mount(preview);
         const media = mediaElement();
         media.currentTime = 730;
         Object.defineProperty(media, "paused", {
            configurable: true,
            value: false,
         });
         await change({
            preview: {
               ...preview,
               url: "https://storage.test/file?signature=two",
            },
         });
         expect(mediaElement()).toBe(media);
         expect(media.src).toBe(preview.url);
         expect(media.currentTime).toBe(730);
         expect(media.paused).toBe(false);
         expect(h.refresh).not.toHaveBeenCalled();
      }
   );

   it.each(["application/pdf", "text/plain", "application/json"])(
      "keeps the mounted %s document on background renewal",
      async (contentType) => {
         const preview = initialPreview(contentType);
         await mount(preview);
         const frame = view.current.container.querySelector("iframe")!;
         await change({
            preview: {
               ...preview,
               url: "https://storage.test/file?signature=two",
            },
         });
         expect(view.current.container.querySelector("iframe")).toBe(frame);
         expect(frame.src).toBe(preview.url);
         expect(frame.getAttribute("sandbox")).toBe(
            contentType === "application/pdf" ? null : ""
         );
      }
   );

   it.each([true, false])(
      "recovers an expired media source and restores paused=%s and its position",
      async (paused) => {
         const preview = initialPreview();
         preview.expiresAt = new Date(Date.now() - 1).toISOString();
         await mount(preview);
         const media = mediaElement();
         const play = vi.spyOn(media, "play").mockResolvedValue();
         media.currentTime = 751;
         Object.defineProperty(media, "paused", {
            configurable: true,
            value: paused,
         });
         const renewed = {
            ...preview,
            url: "https://storage.test/file?signature=two",
            expiresAt: new Date(Date.now() + 900_000).toISOString(),
         };
         h.refresh.mockResolvedValue(renewed);
         await emit(media, "error");
         expect(h.refresh).toHaveBeenCalledOnce();
         expect(mediaElement().src).toBe(renewed.url);
         await emit(mediaElement(), "loadedmetadata");
         expect(mediaElement().currentTime).toBe(751);
         expect(play).toHaveBeenCalledTimes(paused ? 0 : 1);
      }
   );

   it("uses the already renewed authorization on a later range-request failure", async () => {
      const preview = initialPreview();
      await mount(preview);
      const media = mediaElement();
      media.currentTime = 800;
      const renewed = {
         ...preview,
         url: "https://storage.test/file?signature=two",
      };
      await change({ preview: renewed });
      await emit(media, "error");
      expect(mediaElement().src).toBe(renewed.url);
      expect(h.refresh).not.toHaveBeenCalled();
      await emit(mediaElement(), "loadedmetadata");
      mediaElement().currentTime = 802;
      Object.defineProperty(mediaElement(), "readyState", {
         configurable: true,
         value: HTMLMediaElement.HAVE_FUTURE_DATA,
      });
      await emit(mediaElement(), "timeupdate");
      await change({
         preview: {
            ...renewed,
            url: "https://storage.test/file?signature=three",
         },
      });
      await emit(mediaElement(), "error");
      expect(mediaElement().src).toContain("signature=three");
   });

   it("allows another expiry recovery after playback resumes at an earlier seek position", async () => {
      const preview = initialPreview();
      await mount(preview);
      mediaElement().currentTime = 800;
      await change({
         preview: {
            ...preview,
            url: "https://storage.test/file?signature=two",
         },
      });
      await emit(mediaElement(), "error");
      await emit(mediaElement(), "loadedmetadata");
      Object.defineProperty(mediaElement(), "readyState", {
         configurable: true,
         value: HTMLMediaElement.HAVE_FUTURE_DATA,
      });
      mediaElement().currentTime = 100;
      await emit(mediaElement(), "timeupdate");
      mediaElement().currentTime = 102;
      await emit(mediaElement(), "timeupdate");
      await change({
         preview: {
            ...preview,
            url: "https://storage.test/file?signature=three",
         },
      });
      await emit(mediaElement(), "error");
      expect(mediaElement().src).toContain("signature=three");
   });

   it("lets a document recover explicitly without depending on cross-origin iframe errors", async () => {
      const preview = initialPreview("application/pdf");
      await mount(preview);
      const renewed = {
         ...preview,
         url: "https://storage.test/file?signature=two",
      };
      await change({ preview: renewed });
      await act(async () =>
         view.current.container.querySelector("button")!.click()
      );
      expect(view.current.container.querySelector("iframe")!.src).toBe(
         renewed.url
      );
   });

   it("reloads successfully even when a fresh signature is identical within the same second", async () => {
      const preview = initialPreview("application/pdf");
      await mount(preview);
      const original = view.current.container.querySelector("iframe");
      h.refresh.mockResolvedValue(preview);
      await act(async () =>
         view.current.container.querySelector("button")!.click()
      );
      expect(view.current.container.querySelector("iframe")).not.toBe(original);
      expect(view.current.container.querySelector("iframe")!.src).toBe(
         preview.url
      );
      expect(view.current.container.textContent).not.toContain("Couldn't load");
   });

   it("does not retry a source with expired or refused renewed authorization", async () => {
      await mount();
      h.refresh.mockResolvedValue({
         ...initialPreview(),
         url: "https://storage.test/file?signature=two",
         expiresAt: new Date(Date.now() - 1).toISOString(),
      });
      await emit(mediaElement(), "error");
      expect(view.current.container.querySelector("video")).toBeNull();
      expect(view.current.container.textContent).toContain("Couldn't load");
   });

   it.each(["etag", "version", "unversioned", "object"])(
      "replaces the mounted source when the %s identity changes",
      async (identity) => {
         const preview = initialPreview();
         if (identity === "unversioned") preview.eTag = null;
         if (identity === "version") preview.versionId = "version-1";
         await mount(preview);
         const media = mediaElement();
         media.currentTime = 123;
         const replacement = {
            ...preview,
            url: "https://storage.test/file?signature=two",
            ...(identity === "etag" ? { eTag: '"two"' } : {}),
            ...(identity === "version" ? { versionId: "version-2" } : {}),
         };
         await change({
            preview: replacement,
            ...(identity === "object" ? { objectKey: "other-file" } : {}),
         });
         expect(mediaElement()).not.toBe(media);
         expect(mediaElement().src).toBe(replacement.url);
         expect(mediaElement().currentTime).toBe(0);
      }
   );

   it("removes cached media immediately when renewed authorization is refused", async () => {
      await mount();
      await change({ isError: true });
      expect(view.current.container.querySelector("video")).toBeNull();
      expect(view.current.container.textContent).toContain(
         "Couldn't load the preview"
      );
   });

   it("does not restore an in-flight recovery after permission refusal", async () => {
      await mount();
      const renewed = deferred<S3ObjectPreview>();
      h.refresh.mockReturnValue(renewed.promise);
      await emit(mediaElement(), "error");
      await change({ isError: true });
      await act(async () =>
         renewed.resolve({
            ...initialPreview(),
            url: "https://storage.test/file?signature=two",
         })
      );
      expect(view.current.container.querySelector("video")).toBeNull();
   });

   it("does not treat loaded metadata and a failed restored seek as successful recovery", async () => {
      await mount();
      mediaElement().currentTime = 800;
      h.refresh.mockResolvedValue({
         ...initialPreview(),
         url: "https://storage.test/file?signature=two",
      });
      await emit(mediaElement(), "error");
      await emit(mediaElement(), "loadedmetadata");
      await emit(mediaElement(), "timeupdate");
      await emit(mediaElement(), "error");
      expect(h.refresh).toHaveBeenCalledOnce();
      expect(view.current.container.querySelector("video")).toBeNull();
      expect(view.current.container.textContent).toContain("Couldn't load");
   });

   it("bounds automatic recovery when refreshed storage access still fails", async () => {
      await mount();
      h.refresh.mockResolvedValue({
         ...initialPreview(),
         url: "https://storage.test/file?signature=two",
      });
      await emit(mediaElement(), "error");
      await emit(mediaElement(), "error");
      expect(h.refresh).toHaveBeenCalledOnce();
      expect(view.current.container.querySelector("video")).toBeNull();
      expect(view.current.container.textContent).toContain(
         "Couldn't load the preview"
      );
   });
});
