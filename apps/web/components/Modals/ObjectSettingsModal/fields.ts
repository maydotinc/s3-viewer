import {
   MAX_METADATA_KEYS,
   normalizeMetadataName,
   headerValidationIssues,
   metadataValidationIssues,
} from "@s3-viewer/types";

const COMMON_CONTENT_TYPES = [
   "application/json",
   "application/pdf",
   "application/xml",
   "application/zip",
   "application/octet-stream",
   "audio/mpeg",
   "font/woff2",
   "image/avif",
   "image/gif",
   "image/jpeg",
   "image/png",
   "image/svg+xml",
   "image/webp",
   "text/css",
   "text/csv",
   "text/html",
   "text/javascript",
   "text/markdown",
   "text/plain",
   "video/mp4",
];

type MetadataRow = { id: number; key: string; value: string };

const validateHeader = (label: string, value: string): string | null => {
   const issue = headerValidationIssues(value)[0];
   if (!issue) return null;
   return issue.code === "too_long"
      ? `${label} is too long.`
      : `${label} has characters a header can't carry.`;
};

const rowsFromMetadata = (
   metadata: Record<string, string> | undefined
): MetadataRow[] =>
   Object.entries(metadata ?? {}).map(([key, value], index) => ({
      id: index,
      key,
      value,
   }));

const filledRows = (rows: readonly MetadataRow[]) =>
   rows.filter((row) => row.key.trim() !== "" || row.value !== "");

const metadataFromRows = (
   rows: readonly MetadataRow[]
): Record<string, string> => {
   const metadata: Record<string, string> = {};
   for (const row of filledRows(rows))
      metadata[normalizeMetadataName(row.key)] = row.value;
   return metadata;
};

const validateMetadata = (rows: readonly MetadataRow[]): string | null => {
   const entries = filledRows(rows);
   const issue = metadataValidationIssues(entries)[0];
   if (!issue) return null;
   switch (issue.code) {
      case "too_many":
         return `Custom metadata is limited to ${MAX_METADATA_KEYS} entries.`;
      case "missing_key":
         return "Give every metadata value a name.";
      case "invalid_key":
         return `"${entries[issue.row!]!.key.trim()}" isn't a valid name. Use letters, digits and dashes.`;
      case "duplicate_key":
         return `"${issue.key}" is listed twice.`;
      case "invalid_value":
         return `The value for "${issue.key}" has characters a header can't carry.`;
      case "value_too_long":
         return `The value for "${issue.key}" is longer than 1 KiB.`;
      case "total_too_large":
         return "Custom metadata is limited to 2 KiB in total.";
   }
};

const toDateTimeLocal = (iso: string | null | undefined): string => {
   if (!iso) return "";
   const date = new Date(iso);
   if (Number.isNaN(date.getTime())) return "";
   const pad = (value: number) => String(value).padStart(2, "0");
   return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const fromDateTimeLocal = (value: string): string => {
   if (!value) return "";
   const date = new Date(value);
   return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const expiresToSave = (
   value: string,
   loaded: string | null | undefined
): string =>
   value && loaded && value === toDateTimeLocal(loaded)
      ? loaded
      : fromDateTimeLocal(value);

const validateExpires = (value: string): string | null =>
   value && !fromDateTimeLocal(value) ? "That isn't a valid date." : null;

export {
   COMMON_CONTENT_TYPES,
   expiresToSave,
   fromDateTimeLocal,
   metadataFromRows,
   rowsFromMetadata,
   toDateTimeLocal,
   validateExpires,
   validateHeader,
   validateMetadata,
};
export type { MetadataRow };
