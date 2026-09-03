type PreviewKind = "image" | "video" | "audio" | "pdf" | "text" | "none";

const TEXT_TYPES = new Set([
   "application/json",
   "application/xml",
   "application/javascript",
   "application/typescript",
   "application/x-yaml",
   "application/yaml",
   "application/sql",
]);

const previewKind = (contentType: string | null | undefined): PreviewKind => {
   const type = (contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
   if (!type) return "none";
   if (type.startsWith("image/")) return "image";
   if (type.startsWith("video/")) return "video";
   if (type.startsWith("audio/")) return "audio";
   if (type === "application/pdf") return "pdf";
   if (type.startsWith("text/") || TEXT_TYPES.has(type)) return "text";
   return "none";
};

const MAX_PREVIEW_BYTES = 50 * 1024 * 1024;

export { MAX_PREVIEW_BYTES, previewKind };
