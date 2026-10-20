import { PALETTE, type PaletteToken } from "@s3-viewer/ui/lib/palette";

// the brand kit shows and copies hex codes, which read better in upper case.
const brandColor = <T extends PaletteToken>(token: T) => ({
   token,
   hex: PALETTE[token].toUpperCase(),
});

export const BRAND_COLORS = {
   blue: brandColor("viewerblue"),
   darkBlue: brandColor("viewerdarkblue"),
   black: brandColor("viewerblack"),
   text: brandColor("viewertext"),
   light: brandColor("viewerlighttext"),
   border: brandColor("viewerborder"),
   gray: brandColor("viewergray"),
   white: brandColor("viewerwhite"),
   red: brandColor("viewertextred"),
   redBg: brandColor("viewerbgred"),
} as const;

type BrandColor = keyof typeof BRAND_COLORS;

export const C = Object.fromEntries(
   Object.entries(BRAND_COLORS).map(([name, { token }]) => [
      name,
      `var(--color-${token})`,
   ])
) as Record<BrandColor, string>;
