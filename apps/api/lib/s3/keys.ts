import { baseName } from "@s3-viewer/types";
import { createHash } from "node:crypto";

const FALLBACK_FILENAME = "download";

// object keys are user data (names, ids, whole paths): logs correlate on a
// truncated digest instead, which still matches two lines about the same object
const keyHash = (key: string): string =>
   createHash("sha256").update(key, "utf8").digest("hex").slice(0, 16);

const encodeCopySource = (bucket: string, key: string): string =>
   `${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;

const encodeRfc5987 = (value: string): string =>
   encodeURIComponent(value).replace(
      /[!'()*]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
   );

// control chars matter for the rfc 5987 value too, so both are stripped here
// eslint-disable-next-line no-control-regex
const UNSAFE_FILENAME_CHARS = /["\\\u0000-\u001f\u007f]/g;
const NON_ASCII = /[^ -~]/g;

const contentDispositionFilename = (objectKey: string): string => {
   const clean =
      baseName(objectKey).replace(UNSAFE_FILENAME_CHARS, "").trim() ||
      FALLBACK_FILENAME;
   const ascii = clean.replace(NON_ASCII, "_");
   return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeRfc5987(clean)}`;
};

// a presigned url is served from the storage origin, so markup that can carry
// script must never render there: html and xml come back as plain text, and
// svg (which <img> needs served as svg) comes back as a download when opened
// directly, which <img> ignores
const SCRIPTABLE_TEXT: ReadonlySet<string> = new Set([
   "text/html",
   "application/xhtml+xml",
   "text/xml",
   "application/xml",
]);
const SVG = "image/svg+xml";

const mediaType = (stored: string): string =>
   stored.split(";")[0]?.trim().toLowerCase() ?? "";

const inlineContentType = (stored: string): string =>
   SCRIPTABLE_TEXT.has(mediaType(stored)) ? "text/plain" : stored;

const inlineDisposition = (stored: string): "inline" | "attachment" =>
   mediaType(stored) === SVG ? "attachment" : "inline";

export {
   contentDispositionFilename,
   encodeCopySource,
   inlineContentType,
   inlineDisposition,
   keyHash,
};
