import localFont from "next/font/local";

// vendored, not loaded from the Google Fonts loader: builds and self-hosted
// runtimes must never reach out to a third-party font host.
export const inter = localFont({
   src: "../../../packages/ui/src/fonts/InterVariable.woff2",
   weight: "100 900",
   style: "normal",
   display: "swap",
   variable: "--font-inter",
   adjustFontFallback: "Arial",
});
