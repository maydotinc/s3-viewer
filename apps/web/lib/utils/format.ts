const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

const formatBytes = (bytes: number | null | undefined): string => {
   if (bytes === null || bytes === undefined || !Number.isFinite(bytes))
      return "—";
   const safe = Math.max(0, bytes);
   if (safe === 0) return "0 B";
   const exponent = Math.min(
      Math.floor(Math.log(safe) / Math.log(1024)),
      UNITS.length - 1
   );
   const value = safe / 1024 ** exponent;
   const rounded =
      value < 10 && exponent > 0
         ? value.toFixed(1)
         : Math.round(value).toString();
   return `${rounded} ${UNITS[exponent]}`;
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

const formatDate = (iso: string | null | undefined): string => {
   const date = parse(iso);
   return date ? dateTime.format(date) : "—";
};

const formatDay = (iso: string | null | undefined): string => {
   const date = parse(iso);
   return date ? dateOnly.format(date) : "—";
};

const pluralize = (count: number, noun: string): string =>
   `${count} ${noun}${count === 1 ? "" : "s"}`;

export { formatBytes, formatDate, formatDay, pluralize };
