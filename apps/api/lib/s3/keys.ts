import { baseName } from "@s3-viewer/types";

const FALLBACK_FILENAME = "download";

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

export { contentDispositionFilename, encodeCopySource };
