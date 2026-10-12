import localFont from "next/font/local";

export const inter = localFont({
   src: "../../../packages/ui/src/fonts/InterVariable.woff2",
   weight: "100 900",
   style: "normal",
   display: "optional",
   variable: "--font-inter",
   adjustFontFallback: "Arial",
});
