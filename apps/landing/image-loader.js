export default function imageLoader({ src }) {
   let url = src;
   if (process.env.NODE_ENV === "development") {
      url = `http://localhost:3001/${src}`;
   } else {
      url = `https://s3-viewer.onrender.com/${src}`;
   }
   return url;
}
