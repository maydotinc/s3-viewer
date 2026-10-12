// keep a fragment: next/head only hoists direct children.
const FAVICON_LINKS = (
   <>
      <link
         rel="icon"
         href="/favicon-96x96.png"
         type="image/png"
         sizes="96x96"
      />
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
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
