import { z } from "zod";
import {
   contentTypeSchema,
   expectedUserShape,
   utf8ByteLength,
} from "./primitives";
import { notFolder, objectScope, observedETagSchema } from "./s3";

const MAX_METADATA_KEYS = 50;
const MAX_METADATA_VALUE_BYTES = 1024;
const MAX_METADATA_BYTES = 2048;
const MAX_HEADER_LENGTH = 1024;

const METADATA_KEY = /^[a-z0-9-]{1,64}$/;
const PRINTABLE = /^[\x20-\x7e]*$/;

export const normalizeMetadataName = (value: string): string =>
   value.trim().toLowerCase();

type HeaderValidationIssue = { code: "too_long" | "unprintable" };

export const headerValidationIssues = (
   value: string
): HeaderValidationIssue[] => {
   const issues: HeaderValidationIssue[] = [];
   if (value.length > MAX_HEADER_LENGTH) issues.push({ code: "too_long" });
   if (!PRINTABLE.test(value)) issues.push({ code: "unprintable" });
   return issues;
};

type MetadataEntry = { key: string; value: string };
type MetadataValidationIssue = {
   code:
      | "too_many"
      | "missing_key"
      | "invalid_key"
      | "duplicate_key"
      | "invalid_value"
      | "value_too_long"
      | "total_too_large";
   row?: number;
   key?: string;
};

export const metadataValidationIssues = (
   entries: readonly MetadataEntry[]
): MetadataValidationIssue[] => {
   const issues: MetadataValidationIssue[] = [];
   if (entries.length > MAX_METADATA_KEYS) issues.push({ code: "too_many" });
   const seen = new Set<string>();
   let total = 0;
   entries.forEach(({ key: inputKey, value }, row) => {
      const key = normalizeMetadataName(inputKey);
      const add = (code: MetadataValidationIssue["code"]) =>
         issues.push({ code, row, key });
      if (!key) add("missing_key");
      else if (!METADATA_KEY.test(key)) add("invalid_key");
      if (seen.has(key)) add("duplicate_key");
      seen.add(key);
      if (!PRINTABLE.test(value)) add("invalid_value");
      const bytes = utf8ByteLength(value);
      if (bytes > MAX_METADATA_VALUE_BYTES) add("value_too_long");
      total += utf8ByteLength(key) + bytes;
   });
   if (total > MAX_METADATA_BYTES) issues.push({ code: "total_too_large" });
   return issues;
};

const headerSchema = z.string().superRefine((value, ctx) => {
   for (const issue of headerValidationIssues(value))
      ctx.addIssue({
         code: z.ZodIssueCode.custom,
         message:
            issue.code === "too_long"
               ? `Headers are limited to ${MAX_HEADER_LENGTH} characters`
               : "Invalid header value",
      });
});

const metadataMessages: Record<MetadataValidationIssue["code"], string> = {
   too_many: `Use at most ${MAX_METADATA_KEYS} metadata entries`,
   missing_key: "Metadata names use lowercase letters, numbers and dashes",
   invalid_key: "Metadata names use lowercase letters, numbers and dashes",
   duplicate_key:
      "Metadata names must be unique after trimming and lowercasing",
   invalid_value: "Invalid metadata value",
   value_too_long: `Metadata values are limited to ${MAX_METADATA_VALUE_BYTES} bytes`,
   total_too_large: `Metadata is limited to ${MAX_METADATA_BYTES} bytes in total`,
};

const metadataSchema = z
   .record(z.string(), z.string())
   .superRefine((metadata, ctx) => {
      const entries = Object.entries(metadata).map(([key, value]) => ({
         key,
         value,
      }));
      for (const issue of metadataValidationIssues(entries))
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: metadataMessages[issue.code],
            path: issue.row === undefined ? [] : [entries[issue.row]!.key],
         });
   })
   .transform((metadata) =>
      Object.fromEntries(
         Object.entries(metadata).map(([key, value]) => [
            normalizeMetadataName(key),
            value,
         ])
      )
   );

const expiresSchema = z
   .string()
   .trim()
   .max(64)
   .refine(
      (value) => value === "" || !Number.isNaN(Date.parse(value)),
      "Invalid expiry date"
   );

const NO_SETTINGS = "Folders have no settings";

export const objectSettingsQuerySchema = objectScope.refine(
   ...notFolder(NO_SETTINGS)
);

export const updateObjectSettingsBodySchema = objectScope
   .extend({
      ...expectedUserShape,
      expectedETag: observedETagSchema,
      contentType: contentTypeSchema,
      cacheControl: headerSchema.optional(),
      contentDisposition: headerSchema.optional(),
      contentEncoding: headerSchema.optional(),
      contentLanguage: headerSchema.optional(),
      expires: expiresSchema.optional(),
      metadata: metadataSchema,
   })
   .refine(...notFolder(NO_SETTINGS));
export type UpdateObjectSettingsInput = z.infer<
   typeof updateObjectSettingsBodySchema
>;

export { MAX_METADATA_KEYS };
