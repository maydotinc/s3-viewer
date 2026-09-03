const NAME_MAX = 80;
/** Avatars the web app stores inline: 128×128 WebP/PNG is well under this. */
const DATA_IMAGE_MAX_BYTES = 200 * 1024;
/** OAuth providers hand us a URL (GitHub avatars); nothing legitimate is long. */
const URL_IMAGE_MAX_BYTES = 2 * 1024;

const DATA_IMAGE = /^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/]+=*$/;

type ProfileInput = { name?: string; image?: string | null };

type ProfileResult =
   | { ok: true; data: ProfileInput }
   | { ok: false; message: string };

const isHttpUrl = (value: string): boolean => {
   try {
      const { protocol } = new URL(value);
      return protocol === "https:" || protocol === "http:";
   } catch {
      return false;
   }
};

const validateImage = (image: string): string | null => {
   if (DATA_IMAGE.test(image)) {
      return image.length > DATA_IMAGE_MAX_BYTES
         ? "That image is too large. Choose one under 200 KB."
         : null;
   }
   if (isHttpUrl(image)) {
      return image.length > URL_IMAGE_MAX_BYTES
         ? "That image URL is too long."
         : null;
   }
   return "Profile photos must be a PNG, WebP or JPEG image.";
};

/**
 * Checks the profile fields a user may change. Only the keys present in
 * `input` are examined, so other updates (email verification, timestamps)
 * pass through untouched. `image: null` clears the photo.
 */
const validateProfile = ({ name, image }: ProfileInput): ProfileResult => {
   const data: ProfileInput = {};
   if (name !== undefined) {
      const trimmed = name.trim();
      if (trimmed.length === 0 || trimmed.length > NAME_MAX) {
         return {
            ok: false,
            message: `Enter a name of up to ${NAME_MAX} characters.`,
         };
      }
      data.name = trimmed;
   }
   if (image !== undefined) {
      if (image !== null) {
         const message = validateImage(image);
         if (message) return { ok: false, message };
      }
      data.image = image;
   }
   return { ok: true, data };
};

export { DATA_IMAGE_MAX_BYTES, NAME_MAX, URL_IMAGE_MAX_BYTES, validateProfile };
export type { ProfileInput, ProfileResult };
