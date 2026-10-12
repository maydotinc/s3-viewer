const formatters = {
   short: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
   }),
   long: new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
   }),
};

export const formatDate = (iso: string, month: "short" | "long" = "short") =>
   formatters[month].format(new Date(iso));
