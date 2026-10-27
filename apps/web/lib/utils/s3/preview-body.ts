import type { S3ObjectPreview } from "@s3-viewer/shared";

class PreviewTooLargeError extends Error {
   constructor() {
      super("This object is too large to preview. Download it to view.");
      this.name = "PreviewTooLargeError";
   }
}

const previewBodyVersion = (preview: S3ObjectPreview): string => {
   if (preview.versionId && preview.versionId !== "null")
      return JSON.stringify([
         "version",
         preview.versionId,
         preview.contentEncoding,
      ]);
   if (preview.eTag)
      return JSON.stringify(["etag", preview.eTag, preview.contentEncoding]);
   return JSON.stringify(["url", preview.url, preview.contentEncoding]);
};

// a proxy that compresses the response weakens its ETag (W/"...") without the object changing
const eTagValue = (eTag: string): string =>
   eTag.replace(/^W\//i, "").replace(/^"(.*)"$/, "$1");

const changedETag = (reviewed: string | null, served: string | null): boolean =>
   Boolean(reviewed && served && eTagValue(reviewed) !== eTagValue(served));

const readPreviewText = async (
   response: Response,
   maxBytes: number
): Promise<string> => {
   if (Number(response.headers.get("content-length")) > maxBytes) {
      void response.body?.cancel().catch(() => undefined);
      throw new PreviewTooLargeError();
   }
   if (!response.body) return "";
   const reader = response.body.getReader();
   const decoder = new TextDecoder();
   let text = "";
   let bytes = 0;
   try {
      for (;;) {
         const { done, value } = await reader.read();
         if (done) break;
         if (bytes + value.byteLength > maxBytes) {
            void reader.cancel().catch(() => undefined);
            throw new PreviewTooLargeError();
         }
         bytes += value.byteLength;
         text += decoder.decode(value, { stream: true });
      }
      return text + decoder.decode();
   } finally {
      reader.releaseLock();
   }
};

export {
   changedETag,
   PreviewTooLargeError,
   previewBodyVersion,
   readPreviewText,
};
