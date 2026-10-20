// files under public/ that ship as-is: they get a daily cache revalidation and skip the middleware
const STATIC_PUBLIC_FILES = [
   "favicon.ico",
   "favicon.svg",
   "favicon-96x96.png",
   "apple-touch-icon.png",
   "icon-192.png",
   "icon-512.png",
   "icon-maskable-192.png",
   "icon-maskable-512.png",
   "site.webmanifest",
   "social-card.png",
] as const;

const STATIC_PUBLIC_FILE_PATTERN = STATIC_PUBLIC_FILES.map((file) =>
   file.replace(/\./g, "\\.")
).join("|");

export { STATIC_PUBLIC_FILE_PATTERN, STATIC_PUBLIC_FILES };
