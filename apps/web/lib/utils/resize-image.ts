const AVATAR_SIZE = 128;

const loadImage = (file: File): Promise<HTMLImageElement> =>
   new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
         URL.revokeObjectURL(url);
         resolve(image);
      };
      image.onerror = () => {
         URL.revokeObjectURL(url);
         reject(new Error("That file isn't an image we can read."));
      };
      image.src = url;
   });

/**
 * Centre-crops an image file to a square and scales it to 128×128, returning
 * a data URL (WebP where the browser can encode it, PNG otherwise). Small
 * enough to live on the user row, so no upload storage is needed.
 */
const resizeAvatar = async (file: File): Promise<string> => {
   const image = await loadImage(file);
   const side = Math.min(image.naturalWidth, image.naturalHeight);
   if (side === 0) throw new Error("That file isn't an image we can read.");
   const canvas = document.createElement("canvas");
   canvas.width = AVATAR_SIZE;
   canvas.height = AVATAR_SIZE;
   const context = canvas.getContext("2d");
   if (!context) throw new Error("Couldn't process the image.");
   context.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE
   );
   const webp = canvas.toDataURL("image/webp", 0.9);
   return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL();
};

export { AVATAR_SIZE, resizeAvatar };
