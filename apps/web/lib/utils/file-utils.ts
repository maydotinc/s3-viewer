type PreviewKind =
   | "image"
   | "video"
   | "audio"
   | "pdf"
   | "json"
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
   if (type.startsWith("image/")) return "image";
   if (type.startsWith("video/")) return "video";
   if (type.startsWith("audio/")) return "audio";
   if (type === "application/pdf") return "pdf";
   if (JSON_TYPES.has(type) || type.endsWith("+json")) return "json";
   if (GENERIC_TYPES.has(type) && /\.jsonc?$/i.test(fileName ?? ""))
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
   archiveLabel,
   JSON_STRING_PREVIEW_CHARS,
   MAX_JSON_PREVIEW_BYTES,
   MAX_PREVIEW_BYTES,
   isStreamedKind,
   previewKind,
   RAW_TEXT_PREVIEW_CHARS,
};
