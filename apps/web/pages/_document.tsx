import { Head, Html, Main, NextScript } from "next/document";

export default function Document() {
   return (
      <Html lang="en">
         <Head>
            <meta charSet="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <meta name="theme-color" content="#2563eb" />
            <link rel="icon" href="/logo.svg" />
            <link rel="apple-touch-icon" href="/logo.svg" />
            <meta name="application-name" content="S3 Viewer" />
            <meta name="apple-mobile-web-app-title" content="S3 Viewer" />
            <meta name="apple-mobile-web-app-capable" content="yes" />
         </Head>
         <body className="antialiased">
            <Main />
            <NextScript />
         </body>
      </Html>
   );
}
