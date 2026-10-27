import { DAY_MS, replaceUnsafeDisplayChars } from "@s3-viewer/shared";

const BINARY_SIZE_UNITS = ["B", "KiB", "MiB", "GiB", "TiB"] as const;

const formatBytes = (bytes: number | null | undefined): string => {
   if (
      bytes === null ||
      bytes === undefined ||
      !Number.isFinite(bytes) ||
      bytes < 0
   )
      return "—";
   if (bytes === 0) return "0 B";
   const largest = BINARY_SIZE_UNITS.length - 1;
   let exponent = Math.min(
      Math.max(0, Math.floor(Math.log(bytes) / Math.log(1024))),
      largest
   );
   if (exponent < largest && Math.round(bytes / 1024 ** exponent) >= 1024)
      exponent++;
   const value = bytes / 1024 ** exponent;
   const rounded =
      value < 10 && exponent > 0
         ? value.toFixed(1)
         : Math.round(value).toString();
   return `${rounded} ${BINARY_SIZE_UNITS[exponent]}`;
};

const parse = (iso: string | null | undefined): Date | null => {
   if (!iso) return null;
   const date = new Date(iso);
   return Number.isNaN(date.getTime()) ? null : date;
};

const dateTime = new Intl.DateTimeFormat(undefined, {
   dateStyle: "medium",
   timeStyle: "short",
});
const dateOnly = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const relativeDays = new Intl.RelativeTimeFormat(undefined, {
   numeric: "auto",
});

const formatDate = (iso: string | null | undefined): string => {
   const date = parse(iso);
   return date ? dateTime.format(date) : "—";
};

const formatDay = (iso: string | null | undefined): string => {
   const date = parse(iso);
   return date ? dateOnly.format(date) : "—";
};

const formatRelativeDay = (iso: string | null | undefined): string => {
   const date = parse(iso);
   if (!date) return "—";
   return relativeDays.format(
      Math.round((date.getTime() - Date.now()) / DAY_MS),
      "day"
   );
};

const pluralize = (count: number, noun: string): string =>
   `${count} ${noun}${count === 1 ? "" : "s"}`;

const formatCount = (value: number): string => value.toLocaleString();

const joinSentences = (
   ...parts: readonly (string | null | undefined | false)[]
): string =>
   parts
      .map((part) => (part ? part.trim() : ""))
      .filter(Boolean)
      .map((part) => (/[.!?:…]$/.test(part) ? part : `${part}.`))
      .join(" ");

const codePoint = (char: string): string =>
   `[U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}]`;

// storage keys can hold bidi overrides and zero-width marks that reorder or hide part of a name, so
// rendered keys spell them out; display only, the raw key is what goes back to the API
const visibleText = (text: string): string =>
   replaceUnsafeDisplayChars(text, codePoint);

export {
   formatBytes,
   formatCount,
   formatDate,
   formatDay,
   formatRelativeDay,
   joinSentences,
   pluralize,
   visibleText,
};
