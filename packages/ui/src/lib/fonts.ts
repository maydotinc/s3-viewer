import localFont from "next/font/local";

// one declaration for both Next apps; next/font resolves src relative to this file
export const inter = localFont({
   src: "../fonts/InterVariable.woff2",
   weight: "100 900",
   style: "normal",
   display: "optional",
   variable: "--font-inter",
   adjustFontFallback: "Arial",
});
