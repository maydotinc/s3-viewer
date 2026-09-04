// Icon <link>s shared by the web app and the landing site. Every file here is
// generated into BOTH apps/web/public and apps/landing/public by
// scripts/generate-favicons.ts (`pnpm favicons`), so the same root-relative
// URLs resolve whether a landing page is served from its own origin or proxied
// under the web app's domain by apps/web/middleware.ts.
//
// This is a fragment, not a component: next/head only hoists elements that
// are direct children (or one Fragment deep), so render it as
// `<Head>{FAVICON_LINKS}</Head>`.
const FAVICON_LINKS = (
   <>
      {/* Google wants a PNG that is a multiple of 48px with explicit sizes. */}
      <link
         rel="icon"
         href="/favicon-96x96.png"
         type="image/png"
         sizes="96x96"
      />
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      {/* 16/32/48 ICO — the fallback every crawler fetches at /favicon.ico. */}
      <link rel="icon" href="/favicon.ico" sizes="48x48" />
      <link
         rel="apple-touch-icon"
         href="/apple-touch-icon.png"
         sizes="180x180"
      />
      <link rel="manifest" href="/site.webmanifest" />
   </>
);

export { FAVICON_LINKS };
