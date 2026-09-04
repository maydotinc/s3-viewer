/**
 * Avatar identity, derived entirely from the user's name. There are no
 * profile pictures in the product: nothing is uploaded and nothing is stored,
 * so the same name always yields the same initials and the same gradient,
 * everywhere, and the avatar follows a rename the moment the session updates.
 */

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const HUE_STEPS = 360;
/** Second stop sits 40–99° round the wheel, so the two stops never match. */
const HUE_GAP_MIN = 40;
const HUE_GAP_SPREAD = 60;

const hashName = (name: string): number => {
   let hash = FNV_OFFSET_BASIS;
   for (const byte of new TextEncoder().encode(name.trim())) {
      hash = Math.imul(hash ^ byte, FNV_PRIME);
   }
   return hash >>> 0;
};

const avatarInitials = (name: string): string => {
   const letters = name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      // Spread so an astral first character (an emoji name) stays intact.
      .map((word) => [...word][0] ?? "")
      .join("");
   return letters.toUpperCase() || "?";
};

type AvatarHues = { from: number; to: number };

const avatarHues = (name: string): AvatarHues => {
   const hash = hashName(name);
   const from = hash % HUE_STEPS;
   const to =
      (from + HUE_GAP_MIN + ((hash >>> 8) % HUE_GAP_SPREAD)) % HUE_STEPS;
   return { from, to };
};

const avatarGradient = (name: string): string => {
   const { from, to } = avatarHues(name);
   return `linear-gradient(135deg, hsl(${from} 72% 58%), hsl(${to} 68% 42%))`;
};

export { avatarGradient, avatarHues, avatarInitials, hashName };
