import { createRequire } from "node:module";
import { readdirSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

// The brand mark (outline cube in Viewer Blue) is the single source. Every
// favicon, touch icon and manifest icon is that one drawing centred on a
// square canvas, so a brand change is one SVG edit + `pnpm favicons`.
const SOURCE_SVG = path.join(REPO_ROOT, "apps/landing/public/logo.svg");

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

type Variant = {
   // How much of the canvas height the mark occupies. Tab icons fill it; the
   // iOS and maskable icons keep the mark inside the platform's safe zone
   // (a circle 80% of the canvas wide) because the OS crops the rest.
   markHeight: number;
   // iOS paints transparency black and launchers mask to the edge, so those
   // variants sit on an opaque backdrop. Everything else stays transparent.
   background: string | null;
};

const TAB: Variant = { markHeight: 0.92, background: null };
const PADDED: Variant = { markHeight: 0.6, background: "#ffffff" };

// Arbitrary square user-space size the mark is placed into.
const CANVAS = 64;

type Mark = { width: number; height: number; body: string };

const parseMark = (source: string): Mark => {
   const match = source.match(
      /<svg[^>]*viewBox="0 0 ([\d.]+) ([\d.]+)"[^>]*>([\s\S]*)<\/svg>/
   );
   if (!match) {
      throw new Error(
         `${SOURCE_SVG} must be a single <svg> with a viewBox starting at 0 0`
      );
   }
   return {
      width: Number(match[1]),
      height: Number(match[2]),
      body: match[3].trim(),
   };
};

const round = (n: number) => Number(n.toFixed(3));

const buildSvg = (
   mark: Mark,
   { markHeight, background }: Variant,
   size = CANVAS
) => {
   const scale = (markHeight * CANVAS) / mark.height;
   const tx = round((CANVAS - mark.width * scale) / 2);
   const ty = round((CANVAS - mark.height * scale) / 2);
   const backdrop = background
      ? `<rect width="${CANVAS}" height="${CANVAS}" fill="${background}"/>\n`
      : "";
   return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${CANVAS} ${CANVAS}" fill="none">\n` +
      backdrop +
      `<g transform="translate(${tx} ${ty}) scale(${round(scale)})">\n${mark.body}\n</g>\n` +
      `</svg>\n`
   );
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
   const mark = parseMark(await readFile(SOURCE_SVG, "utf8"));

   const files = new Map<string, Buffer | string>();

   // Vector favicon: the browser rasterises it at whatever size the tab needs.
   files.set("favicon.svg", buildSvg(mark, TAB));

   // Legacy + crawler fallback fetched at /favicon.ico regardless of markup.
   // 48px satisfies Google's "multiple of 48px" rule; 16/32 are what tabs use.
   const icoEntries = await Promise.all(
      [16, 32, 48].map(async (size) => ({
         size,
         data: dibEntry(
            await renderRgba(buildSvg(mark, TAB, size), size),
            size
         ),
      }))
   );
   files.set("favicon.ico", buildIco(icoEntries));

   // Google's preferred explicit-size PNG (multiple of 48).
   files.set("favicon-96x96.png", await renderPng(buildSvg(mark, TAB, 96)));

   // iOS home screen: opaque, iOS rounds the corners itself.
   files.set(
      "apple-touch-icon.png",
      await renderPng(buildSvg(mark, PADDED, 180))
   );

   // Web app manifest icons.
   for (const size of [192, 512]) {
      files.set(`icon-${size}.png`, await renderPng(buildSvg(mark, TAB, size)));
      files.set(
         `icon-maskable-${size}.png`,
         await renderPng(buildSvg(mark, PADDED, size))
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
