export default function imageLoader({ src, width, quality }) {
   const base =
      process.env.NODE_ENV === "development"
         ? "https://landing.localhost"
         : "https://s3-viewer-lp.vercel.app";
   return `${base}${src}?w=${width}&q=${quality || 75}`;
}
