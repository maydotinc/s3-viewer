// mirrors the @theme block in styles/globals.css for code that cannot read css
// (emails, meta tags, brand swatches); keep the two in sync.
const PALETTE = {
   viewerblue: "#3658c1",
   viewerdarkblue: "#253977",
   viewerwhite: "#ffffff",
   viewerborder: "#e1e4ea",
   viewercontrolborder: "#868fa1",
   viewergray: "#f7f7f7",
   viewertext: "#525866",
   viewerblack: "#0e121b",
   viewerlighttext: "#636c7e",
   viewertextred: "#fb3748",
   viewerstrongred: "#d11a2d",
   viewerbgred: "#feebec",
} as const;

type PaletteToken = keyof typeof PALETTE;

export { PALETTE };
export type { PaletteToken };
