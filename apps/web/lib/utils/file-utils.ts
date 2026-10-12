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

const JSON_EXTENSION_FALLBACK_TYPES = new Set([
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
   if (JSON_TYPES.has(type) || type.endsWith("+json")) return "json";
   if (
      JSON_EXTENSION_FALLBACK_TYPES.has(type) &&
      /\.jsonc?$/i.test(fileName ?? "")
   )
      return "json";
   if (type.startsWith("text/") || TEXT_TYPES.has(type)) return "text";
   return "none";
};

const MAX_PREVIEW_BYTES = 50 * 1024 * 1024;

const isStreamedKind = (kind: PreviewKind): boolean =>
   kind === "video" || kind === "audio" || kind === "pdf";

const MAX_JSON_PREVIEW_BYTES = 2 * 1024 * 1024;
const JSON_STRING_PREVIEW_CHARS = 1000;

const RAW_TEXT_PREVIEW_CHARS = 100000;

export {
   JSON_STRING_PREVIEW_CHARS,
   MAX_JSON_PREVIEW_BYTES,
   MAX_PREVIEW_BYTES,
   isStreamedKind,
   previewKind,
   RAW_TEXT_PREVIEW_CHARS,
};
