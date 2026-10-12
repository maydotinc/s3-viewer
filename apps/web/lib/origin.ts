const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

const origin = (value: string | undefined): string => {
   const trimmed = value?.trim() ?? "";
   if (!trimmed) return "";
   const withScheme = HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;
   try {
      const parsed = new URL(withScheme);
      return parsed.protocol === "http:" || parsed.protocol === "https:"
         ? parsed.origin
         : "";
   } catch {
      return "";
   }
};

export { origin };
