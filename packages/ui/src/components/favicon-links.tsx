// every file is generated into both apps' public dirs by `pnpm favicons`, so
// these root-relative urls resolve from either origin. a fragment, not a
// component: next/head only hoists direct children, so render it as
// `<Head>{FAVICON_LINKS}</Head>`
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
