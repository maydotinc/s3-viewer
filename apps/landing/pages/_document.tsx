import { inter } from "@/lib/fonts";
import { Head, Html, Main, NextScript } from "next/document";

export default function Document() {
   return (
      <Html lang="en" className={inter.variable}>
         <Head />
         <body className="antialiased">
            <Main />
            <NextScript />
         </body>
      </Html>
   );
}
