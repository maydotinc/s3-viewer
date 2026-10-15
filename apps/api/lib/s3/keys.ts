import { ApiHttpError } from "@/lib/http";
import { baseName } from "@s3-viewer/types";
import { createHash } from "node:crypto";

// AWS SDKs decode listing "url" encoding as form encoding: "+" is a space.
const decodeListedKey = (value: string): string => {
   try {
      return decodeURIComponent(value.replaceAll("+", " "));
   } catch {
      throw new ApiHttpError(
         502,
         "Storage returned an invalid encoded object key."
      );
   }
};

const decodeOptionalKey = (value: string | undefined): string | undefined =>
   value === undefined ? undefined : decodeListedKey(value);

// eslint-disable-next-line no-control-regex -- control characters are what this pattern matches
const NEEDS_INDIVIDUAL_DELETE = /[\u0000-\u001f￾￿]/u;

const requiresIndividualDelete = (key: string): boolean =>
   NEEDS_INDIVIDUAL_DELETE.test(key);

const assertObjectSize = (size: number | undefined): number => {
   if (size === undefined || !Number.isSafeInteger(size) || size < 0)
      throw new ApiHttpError(502, "Storage returned an invalid object size.");
   return size;
};

// UTF-16 order matches S3's UTF-8 order except that surrogates sort below U+E000-U+FFFF.
const utf8Unit = (unit: number): number =>
   unit < 0xd800 ? unit : unit < 0xe000 ? unit + 0x2000 : unit - 0x800;

const compareUtf8 = (a: string, b: string): number => {
   const length = Math.min(a.length, b.length);
   for (let i = 0; i < length; i++) {
      const left = a.charCodeAt(i);
      const right = b.charCodeAt(i);
      if (left !== right) return utf8Unit(left) - utf8Unit(right);
   }
   return a.length - b.length;
};

const utf8Before = (a: string, b: string): boolean => compareUtf8(a, b) < 0;

// splitting a surrogate pair would send U+FFFD to S3 and change the prefix.
const withoutLoneSurrogate = (value: string): string => {
   const tail = value.charCodeAt(value.length - 1);
   return tail >= 0xd800 && tail <= 0xdbff ? value.slice(0, -1) : value;
};

const justBefore = (key: string): string =>
   withoutLoneSurrogate(key.slice(0, -1));

const FALLBACK_FILENAME = "download";

const keyHash = (key: string): string =>
   createHash("sha256").update(key, "utf8").digest("hex").slice(0, 16);

const encodeCopySource = (bucket: string, key: string): string =>
   `${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;

const encodeRfc5987 = (value: string): string =>
   encodeURIComponent(value).replace(
      /[!'()*]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
   );

// eslint-disable-next-line no-control-regex -- control characters are what this pattern strips
const UNSAFE_FILENAME_CHARS = /["\\\u0000-\u001f\u007f]/g;
const NON_ASCII = /[^ -~]/g;

const contentDispositionFilename = (objectKey: string): string => {
   const clean =
      baseName(objectKey).replace(UNSAFE_FILENAME_CHARS, "").trim() ||
      FALLBACK_FILENAME;
   const ascii = clean.replace(NON_ASCII, "_");
   return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeRfc5987(clean)}`;
};

// presigned URLs bypass sessions; prevent active markup from executing on the storage origin.
const SVG = "image/svg+xml";
const SCRIPTABLE_TEXT =
   /^(text\/html|application\/xhtml\+xml|text\/xsl|multipart\/.*|.*[/+]xml)$/;
const MEDIA_TYPE = /^[\w!#$%&'*+.^`|~-]+\/[\w!#$%&'*+.^`|~-]+$/;
const SNIFFED: ReadonlySet<string> = new Set([
   "*/*",
   "application/unknown",
   "application/x-unknown-content-type",
   "unknown/unknown",
]);

// browsers honour the last valid entry of a comma-separated Content-Type.
const mediaTypes = (stored: string): string[] =>
   stored.split(",").map((entry) => entry.split(";")[0]!.trim().toLowerCase());

const scriptable = (type: string): boolean =>
   !MEDIA_TYPE.test(type) ||
   SNIFFED.has(type) ||
   (type !== SVG && SCRIPTABLE_TEXT.test(type));

const inlineContentType = (stored: string): string =>
   mediaTypes(stored).some(scriptable) ? "text/plain" : stored;

const inlineDisposition = (stored: string): "inline" | "attachment" =>
   mediaTypes(stored).includes(SVG) ? "attachment" : "inline";

export {
   assertObjectSize,
   compareUtf8,
   contentDispositionFilename,
   decodeOptionalKey,
   encodeCopySource,
   inlineContentType,
   inlineDisposition,
   justBefore,
   keyHash,
   requiresIndividualDelete,
   utf8Before,
   withoutLoneSurrogate,
};
