type PreviewKind =
   | "image"
   | "video"
   | "audio"
   | "pdf"
   | "json"
   | "text"
   | "none";

const TEXT_TYPES = new Set([
   "application/xml",
   "application/javascript",
   "application/typescript",
   "application/x-yaml",
   "application/yaml",
   "application/sql",
]);

const JSON_TYPES = new Set(["application/json", "text/json"]);

/**
 * Types that say nothing about the content. S3 stores whatever the uploader
 * sent, and plenty of clients send these for a `.json` file, so the extension
 * is the only hint left.
 */
const UNTYPED = new Set([
   "application/octet-stream",
   "binary/octet-stream",
   "text/plain",
]);

const previewKind = (
   contentType: string | null | undefined,
   fileName?: string
): PreviewKind => {
   const type = (contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
   if (!type) return "none";
   if (type.startsWith("image/")) return "image";
   if (type.startsWith("video/")) return "video";
   if (type.startsWith("audio/")) return "audio";
   if (type === "application/pdf") return "pdf";
   // `+json` covers the structured-suffix types: geo+json, ld+json, vnd.…+json.
   if (JSON_TYPES.has(type) || type.endsWith("+json")) return "json";
   if (UNTYPED.has(type) && /\.jsonc?$/i.test(fileName ?? "")) return "json";
   if (type.startsWith("text/") || TEXT_TYPES.has(type)) return "text";
   return "none";
};

const MAX_PREVIEW_BYTES = 50 * 1024 * 1024;

/**
 * Past this the viewer stops building a tree and hands the file to the plain
 * text preview: a document this size is read by searching, not by scrolling.
 */
const MAX_JSON_PREVIEW_BYTES = 2 * 1024 * 1024;

export { MAX_JSON_PREVIEW_BYTES, MAX_PREVIEW_BYTES, previewKind };
export type { PreviewKind };
