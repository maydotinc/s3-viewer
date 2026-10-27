import { MIB } from "@s3-viewer/shared";

type PreviewKind =
   | "image"
   | "video"
   | "audio"
   | "pdf"
   | "json"
   | "markdown"
   | "text"
   | "archive"
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

// what every current browser decodes in an <img>; heic, tiff and the like only error and re-fetch
const IMAGE_TYPES = new Set([
   "image/apng",
   "image/avif",
   "image/bmp",
   "image/gif",
   "image/jpeg",
   "image/png",
   "image/svg+xml",
   "image/vnd.microsoft.icon",
   "image/webp",
   "image/x-icon",
]);

const MARKDOWN_TYPES = new Set(["text/markdown", "text/x-markdown"]);
const MARKDOWN_NAME = /\.(md|markdown|mdown|mkd)$/i;

// uploaders often leave these on files whose extension says what they really are
const GENERIC_TYPES = new Set([
   "",
   "application/octet-stream",
   "binary/octet-stream",
   "text/plain",
]);

const ARCHIVE_TYPES: Record<string, string> = {
   "application/zip": "ZIP archive",
   "application/x-zip-compressed": "ZIP archive",
   "application/x-tar": "TAR archive",
   "application/gzip": "Gzip archive",
   "application/x-gzip": "Gzip archive",
   "application/x-7z-compressed": "7-Zip archive",
   "application/vnd.rar": "RAR archive",
   "application/x-rar-compressed": "RAR archive",
   "application/x-bzip2": "Bzip2 archive",
   "application/zstd": "Zstandard archive",
};

const ARCHIVE_EXTENSIONS: [RegExp, string][] = [
   [/\.(tar\.gz|tgz)$/i, "Gzipped TAR archive"],
   [/\.zip$/i, "ZIP archive"],
   [/\.tar$/i, "TAR archive"],
   [/\.gz$/i, "Gzip archive"],
   [/\.7z$/i, "7-Zip archive"],
   [/\.rar$/i, "RAR archive"],
   [/\.bz2$/i, "Bzip2 archive"],
   [/\.zst$/i, "Zstandard archive"],
];

// Chrome answers "" for quicktime yet plays the H.264 inside most .mov files;
// the preview's error fallback covers the codecs it cannot decode
const PLAYABLE_ANYWAY = new Set(["video/quicktime"]);

// codec support differs per browser, so only the browser can say what it plays
const canPlay = (element: "video" | "audio", type: string): boolean =>
   PLAYABLE_ANYWAY.has(type) ||
   (typeof document !== "undefined" &&
      document.createElement(element).canPlayType(type) !== "");

const mimeType = (contentType: string | null | undefined): string =>
   (contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";

// the extension wins when it says more than the type (tar.gz over application/gzip)
const archiveLabel = (
   contentType: string | null | undefined,
   fileName?: string
): string | null => {
   const type = mimeType(contentType);
   const byName = ARCHIVE_EXTENSIONS.find(([pattern]) =>
      pattern.test(fileName ?? "")
   )?.[1];
   const byType = ARCHIVE_TYPES[type];
   if (byType) return byName ?? byType;
   return GENERIC_TYPES.has(type) ? (byName ?? null) : null;
};

const previewKind = (
   contentType: string | null | undefined,
   fileName?: string
): PreviewKind => {
   if (archiveLabel(contentType, fileName)) return "archive";
   const type = mimeType(contentType);
   if (!type) return "none";
   if (IMAGE_TYPES.has(type)) return "image";
   if (type.startsWith("video/"))
      return canPlay("video", type) ? "video" : "none";
   if (type.startsWith("audio/"))
      return canPlay("audio", type) ? "audio" : "none";
   if (type.startsWith("image/")) return "none";
   if (type === "application/pdf") return "pdf";
   if (JSON_TYPES.has(type) || type.endsWith("+json")) return "json";
   if (GENERIC_TYPES.has(type) && /\.jsonc?$/i.test(fileName ?? ""))
      return "json";
   if (
      MARKDOWN_TYPES.has(type) ||
      (GENERIC_TYPES.has(type) && MARKDOWN_NAME.test(fileName ?? ""))
   )
      return "markdown";
   if (type.startsWith("text/") || TEXT_TYPES.has(type)) return "text";
   return "none";
};

const MAX_PREVIEW_BYTES = 50 * MIB;

const isStreamedKind = (kind: PreviewKind): boolean =>
   kind === "video" || kind === "audio" || kind === "pdf";

// json and markdown previews read the body into memory, so they stop well short of MAX_PREVIEW_BYTES
const MAX_BODY_PREVIEW_BYTES = 2 * MIB;
const JSON_STRING_PREVIEW_CHARS = 1000;

// marked lexes on the main thread and is quadratic on unmatched emphasis (32 KiB of it takes ~2 s), so bigger documents show as source
const MARKDOWN_RENDER_BYTES = 32 * 1024;

const RAW_TEXT_PREVIEW_CHARS = 100000;

export {
   archiveLabel,
   JSON_STRING_PREVIEW_CHARS,
   MARKDOWN_RENDER_BYTES,
   MAX_BODY_PREVIEW_BYTES,
   MAX_PREVIEW_BYTES,
   isStreamedKind,
   previewKind,
   RAW_TEXT_PREVIEW_CHARS,
};
