import { createRequire } from "node:module";
import { readdirSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

// The brand kit's "App Icon" (filled mark on the Viewer Blue tile) is the
// single source. Everything below is derived from it, so a brand change is
// one SVG edit + `pnpm favicons`.
const SOURCE_SVG = path.join(
   REPO_ROOT,
   "apps/landing/public/icons/viewerblue.svg"
);

// The landing site is reverse-proxied behind the web app in production, so
// its pages are served from the web app's domain and every root-relative icon
// URL they emit resolves against apps/web/public — while a standalone landing
// build (and `next dev` on its own port) resolves them against
// apps/landing/public. Writing the identical set into both keeps
// `<link rel="icon">` truthful from either origin. The shared markup lives in
// packages/ui/src/components/favicon-links.tsx.
const OUT_DIRS = ["apps/web/public", "apps/landing/public"].map((dir) =>
   path.join(REPO_ROOT, dir)
);

// Previous generations' filenames; deleted so stale icons can't linger.
const STALE_FILES = [
   "web-app-manifest-192x192.png",
   "web-app-manifest-512x512.png",
];

const resolveSharp = (): typeof import("sharp") => {
   try {
      return require("sharp");
   } catch {
      // Not hoisted to the repo root — fall back to the pnpm virtual store.
   }
   const pnpmDir = path.join(REPO_ROOT, "node_modules/.pnpm");
   const entry = readdirSync(pnpmDir).find((e) => e.startsWith("sharp@"));
   if (!entry) {
      throw new Error(
         "sharp not found under node_modules/.pnpm — run `pnpm install` at the repo root."
      );
   }
   return require(path.join(pnpmDir, entry, "node_modules/sharp"));
};

const sharp = resolveSharp();

// Geometry of icons/viewerblue.svg: a 104×104 tile drawn at y=0.1875 inside a
// 104×105 viewBox, corner radius 20, mark centred on the tile.
const TILE = 104;
const TILE_Y = 0.1875;
// The <mask> repeats the same width/height, so anchor on the <svg> tag.
const SOURCE_SVG_TAG = `<svg width="${TILE}" height="${TILE + 1}" viewBox="0 0 ${TILE} ${TILE + 1}"`;
const squareSvgTag = (size: number) =>
   `<svg width="${size}" height="${size}" viewBox="0 ${TILE_Y} ${TILE} ${TILE}"`;
const ROUNDED_CORNER = ` rx="20"`;
const MARK_GROUP = /<g mask="url\(#[^"]+\)">[\s\S]*?<\/g>/;
const MARK_GROUP_OPEN = /<g mask="url\(#[^"]+\)">/;
const SHEEN_MASK = /<mask [\s\S]*?<\/mask>\n?/;
const SHEEN_GRADIENT =
   /<linearGradient id="paint1_[\s\S]*?<\/linearGradient>\n?/;

type Variant = {
   // Rounded tile with transparent corners (tab icons, "any" launcher icons)
   // vs. full-bleed square (iOS home screen and maskable icons — the platform
   // applies its own mask, so the tile must fill the canvas).
   fullBleed: boolean;
   // Enlarge the mark around the tile centre. At 16–32px the brand asset's
   // 48%-wide mark collapses into a blob; ~60% stays legible without touching
   // the tile edge. Maskable icons must keep the mark inside the 80% safe zone.
   markScale: number;
   // The brand asset fades the mark with a diagonal sheen. It reads as depth
   // at 48px+, but at tab sizes it just costs contrast, so drop it there.
   sheen: boolean;
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const replaceOnce = (svg: string, from: string | RegExp, to: string) => {
   const pattern = new RegExp(
      from instanceof RegExp ? from.source : escapeRegExp(from),
      "g"
   );
   if ([...svg.matchAll(pattern)].length !== 1) {
      throw new Error(
         `Expected exactly one match for ${String(from)} in ${SOURCE_SVG} — the brand asset changed shape; update this script's geometry constants.`
      );
   }
   return svg.replace(from, to);
};

const buildSvg = (
   source: string,
   { fullBleed, markScale, sheen }: Variant,
   size?: number
) => {
   let svg = replaceOnce(source, SOURCE_SVG_TAG, squareSvgTag(size ?? TILE));
   if (fullBleed) svg = replaceOnce(svg, ROUNDED_CORNER, "");
   if (markScale !== 1) {
      const cx = TILE / 2;
      const cy = TILE_Y + TILE / 2;
      svg = replaceOnce(
         svg,
         MARK_GROUP,
         `<g transform="translate(${cx} ${cy}) scale(${markScale}) translate(${-cx} ${-cy})">$&</g>`
      );
   }
   if (!sheen) {
      svg = replaceOnce(svg, MARK_GROUP_OPEN, "<g>");
      svg = replaceOnce(svg, SHEEN_MASK, "");
      svg = replaceOnce(svg, SHEEN_GRADIENT, "");
   }
   return svg;
};

const renderPng = (svg: string) =>
   sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();

const renderRgba = async (svg: string, size: number) => {
   const { data, info } = await sharp(Buffer.from(svg))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
   if (info.width !== size || info.height !== size || info.channels !== 4) {
      throw new Error(
         `Expected ${size}×${size} RGBA, got ${info.width}×${info.height}×${info.channels}`
      );
   }
   return data;
};

// Classic 32-bit DIB entries (BITMAPINFOHEADER + bottom-up BGRA + 1-bit AND
// mask) rather than PNG-in-ICO: every favicon parser from Windows XP to
// Google's crawler reads these, PNG entries only newer ones.
const dibEntry = (rgba: Buffer, size: number): Buffer => {
   const rowBytes = size * 4;
   const maskRowBytes = Math.ceil(size / 32) * 4;
   const header = Buffer.alloc(40);
   header.writeUInt32LE(40, 0);
   header.writeInt32LE(size, 4);
   header.writeInt32LE(size * 2, 8); // XOR + AND masks stacked
   header.writeUInt16LE(1, 12); // planes
   header.writeUInt16LE(32, 14); // bpp
   header.writeUInt32LE(0, 16); // BI_RGB
   header.writeUInt32LE(rowBytes * size + maskRowBytes * size, 20);

   const pixels = Buffer.alloc(rowBytes * size);
   const mask = Buffer.alloc(maskRowBytes * size);
   for (let y = 0; y < size; y++) {
      const srcRow = size - 1 - y;
      for (let x = 0; x < size; x++) {
         const src = (srcRow * size + x) * 4;
         const dst = y * rowBytes + x * 4;
         const alpha = rgba[src + 3];
         pixels[dst] = rgba[src + 2];
         pixels[dst + 1] = rgba[src + 1];
         pixels[dst + 2] = rgba[src];
         pixels[dst + 3] = alpha;
         if (alpha === 0) mask[y * maskRowBytes + (x >> 3)] |= 0x80 >> (x & 7);
      }
   }
   return Buffer.concat([header, pixels, mask]);
};

const buildIco = (entries: { size: number; data: Buffer }[]): Buffer => {
   const dir = Buffer.alloc(6);
   dir.writeUInt16LE(0, 0);
   dir.writeUInt16LE(1, 2); // ICO
   dir.writeUInt16LE(entries.length, 4);
   let offset = 6 + 16 * entries.length;
   const dirEntries = entries.map(({ size, data }) => {
      const b = Buffer.alloc(16);
      b.writeUInt8(size === 256 ? 0 : size, 0);
      b.writeUInt8(size === 256 ? 0 : size, 1);
      b.writeUInt16LE(1, 4); // planes
      b.writeUInt16LE(32, 6); // bpp
      b.writeUInt32LE(data.length, 8);
      b.writeUInt32LE(offset, 12);
      offset += data.length;
      return b;
   });
   return Buffer.concat([dir, ...dirEntries, ...entries.map((e) => e.data)]);
};

const ROUNDED: Variant = { fullBleed: false, markScale: 1, sheen: true };
const ROUNDED_SMALL: Variant = {
   fullBleed: false,
   markScale: 1.25,
   sheen: false,
};
const FULL_BLEED: Variant = { fullBleed: true, markScale: 1, sheen: true };

const MANIFEST = {
   id: "/",
   name: "S3 Viewer",
   short_name: "S3 Viewer",
   description: "Browse and share S3-compatible storage.",
   start_url: "/dashboard",
   scope: "/",
   display: "standalone",
   lang: "en",
   theme_color: "#3658c1",
   background_color: "#ffffff",
   icons: [
      {
         src: "/icon-192.png",
         sizes: "192x192",
         type: "image/png",
         purpose: "any",
      },
      {
         src: "/icon-512.png",
         sizes: "512x512",
         type: "image/png",
         purpose: "any",
      },
      {
         src: "/icon-maskable-192.png",
         sizes: "192x192",
         type: "image/png",
         purpose: "maskable",
      },
      {
         src: "/icon-maskable-512.png",
         sizes: "512x512",
         type: "image/png",
         purpose: "maskable",
      },
   ],
};

const main = async () => {
   const source = await readFile(SOURCE_SVG, "utf8");

   const files = new Map<string, Buffer | string>();

   // Vector favicon: the browser rasterises it at whatever size the tab needs.
   files.set("favicon.svg", buildSvg(source, ROUNDED_SMALL) + "\n");

   // Legacy + crawler fallback fetched at /favicon.ico regardless of markup.
   // 48px satisfies Google's "multiple of 48px" rule; 16/32 are what tabs use.
   const icoEntries = await Promise.all(
      [16, 32, 48].map(async (size) => ({
         size,
         data: dibEntry(
            await renderRgba(buildSvg(source, ROUNDED_SMALL, size), size),
            size
         ),
      }))
   );
   files.set("favicon.ico", buildIco(icoEntries));

   // Google's preferred explicit-size PNG (multiple of 48).
   files.set(
      "favicon-96x96.png",
      await renderPng(buildSvg(source, ROUNDED, 96))
   );

   // iOS home screen: opaque, full-bleed, iOS rounds the corners itself.
   files.set(
      "apple-touch-icon.png",
      await renderPng(buildSvg(source, FULL_BLEED, 180))
   );

   // Web app manifest icons.
   for (const size of [192, 512]) {
      files.set(
         `icon-${size}.png`,
         await renderPng(buildSvg(source, ROUNDED, size))
      );
      files.set(
         `icon-maskable-${size}.png`,
         await renderPng(buildSvg(source, FULL_BLEED, size))
      );
   }

   files.set("site.webmanifest", JSON.stringify(MANIFEST, null, 3) + "\n");

   for (const dir of OUT_DIRS) {
      for (const stale of STALE_FILES) {
         await rm(path.join(dir, stale), { force: true });
      }
      for (const [name, contents] of files) {
         await writeFile(path.join(dir, name), contents);
      }
   }

   console.table(
      [...files].map(([name, contents]) => ({
         file: name,
         bytes: Buffer.byteLength(contents),
      }))
   );
   console.log(
      `Wrote ${files.size} files into:\n${OUT_DIRS.map((d) => `  ${path.relative(REPO_ROOT, d)}`).join("\n")}`
   );
};

main().catch((err) => {
   console.error(err);
   process.exit(1);
});
