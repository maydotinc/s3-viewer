// icon-only below the container breakpoint, labelled above it; literal strings so Tailwind sees every class
const COMPACT = {
   md: {
      button: "w-9 px-0 pointer-coarse:@max-md:w-11 @md:w-auto @md:px-4",
      label: "sr-only @md:not-sr-only @md:whitespace-nowrap",
      chevron: "hidden @md:block",
   },
   xl: {
      button: "w-9 px-0 pointer-coarse:@max-xl:w-11 @xl:w-auto @xl:px-4",
      label: "sr-only @xl:not-sr-only @xl:whitespace-nowrap",
      chevron: "hidden @xl:block",
   },
} as const;

export { COMPACT };
