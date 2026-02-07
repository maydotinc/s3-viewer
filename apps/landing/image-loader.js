export default function imageLoader({ src, width, quality }) {
   const base =
      process.env.NODE_ENV === "development"
         ? "http://localhost:3001"
         : "https://s3-viewer.onrender.com";
   return `${base}${src}?w=${width}&q=${quality || 75}`;
}
