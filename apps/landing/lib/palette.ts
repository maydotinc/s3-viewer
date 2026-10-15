// keep these values in sync with packages/ui/src/styles/globals.css.
export const BRAND_COLORS = {
   blue: { token: "viewerblue", hex: "#3658C1" },
   darkBlue: { token: "viewerdarkblue", hex: "#253977" },
   black: { token: "viewerblack", hex: "#0E121B" },
   text: { token: "viewertext", hex: "#525866" },
   light: { token: "viewerlighttext", hex: "#636C7E" },
   border: { token: "viewerborder", hex: "#E1E4EA" },
   gray: { token: "viewergray", hex: "#F7F7F7" },
   white: { token: "viewerwhite", hex: "#FFFFFF" },
   red: { token: "viewertextred", hex: "#FB3748" },
   redBg: { token: "viewerbgred", hex: "#FEEBEC" },
} as const;

type BrandColor = keyof typeof BRAND_COLORS;

export const C = Object.fromEntries(
   Object.entries(BRAND_COLORS).map(([name, { token }]) => [
      name,
      `var(--color-${token})`,
   ])
) as Record<BrandColor, string>;
