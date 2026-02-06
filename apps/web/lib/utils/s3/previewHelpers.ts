const PREVIEWABLE_TYPES = [
   "image/jpeg",
   "image/png",
   "image/gif",
   "image/webp",
   "image/svg+xml",
   "text/plain",
   "text/html",
   "text/css",
   "text/javascript",
   "text/x-python",
   "text/x-java",
   "text/x-c",
   "application/json",
   "application/xml",
   "text/xml",
   "application/pdf",
   "text/markdown",
   "text/x-markdown",
   "application/javascript",
   "application/typescript",
   "video/mp4",
   "video/webm",
   "video/ogg",
   "video/quicktime",
   "video/x-msvideo",
];

const isPreviewable = (contentType?: string): boolean => {
   if (!contentType) return false;
   return PREVIEWABLE_TYPES.some((type) =>
      contentType.toLowerCase().startsWith(type)
   );
};

type PreviewType = "image" | "video" | "iframe" | "none";

const getPreviewType = (contentType?: string): PreviewType => {
   if (!contentType) return "none";

   const lowerType = contentType.toLowerCase();

   if (lowerType.startsWith("image/")) return "image";
   if (lowerType.startsWith("video/")) return "video";
   return "iframe";
};

export { getPreviewType, isPreviewable };
export type { PreviewType };
