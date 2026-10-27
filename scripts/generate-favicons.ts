import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const WEB_PUBLIC = path.join(REPO_ROOT, "apps/web/public");
const LANDING_PUBLIC = path.join(REPO_ROOT, "apps/landing/public");

const SOURCE_SVG = path.join(LANDING_PUBLIC, "landing/logo.svg");

// landing is standalone in dev and proxied in production, so icons go in both public dirs.
const OUT_DIRS = [WEB_PUBLIC, LANDING_PUBLIC];

// landing owns the logo files; the web app only references the mark, so that is all it gets a copy of.
const MIRRORED_SVGS = ["icons/viewer.svg"];

type Variant = {
   markHeight: number;
   background: string | null;
};

// padded icons keep the mark in the 80% safe zone on an opaque backdrop (iOS paints transparency black).
const TAB: Variant = { markHeight: 0.92, background: null };
const PADDED: Variant = { markHeight: 0.6, background: "#ffffff" };

const CANVAS = 64;

type Mark = { width: number; height: number; body: string };

const parseMark = (source: string): Mark => {
   const match = source.match(
      /<svg[^>]*viewBox="0 0 ([\d.]+) ([\d.]+)"[^>]*>([\s\S]*)<\/svg>/
   );
   const [, width, height, body] = match ?? [];
   if (!width || !height || body === undefined) {
      throw new Error(
         `${SOURCE_SVG} must be a single <svg> with a viewBox starting at 0 0`
      );
   }
   return { width: Number(width), height: Number(height), body: body.trim() };
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

const dibEntry = (rgba: Buffer, size: number): Buffer => {
   const rowBytes = size * 4;
   const maskRowBytes = Math.ceil(size / 32) * 4;
   const header = Buffer.alloc(40);
   header.writeUInt32LE(40, 0);
   header.writeInt32LE(size, 4);
   header.writeInt32LE(size * 2, 8); // XOR + AND masks stacked
   header.writeUInt16LE(1, 12);
   header.writeUInt16LE(32, 14);
   header.writeUInt32LE(0, 16);
   header.writeUInt32LE(rowBytes * size + maskRowBytes * size, 20);

   const pixels = Buffer.alloc(rowBytes * size);
   const mask = Buffer.alloc(maskRowBytes * size);
   for (let y = 0; y < size; y++) {
      const srcRow = size - 1 - y;
      for (let x = 0; x < size; x++) {
         const src = (srcRow * size + x) * 4;
         const dst = y * rowBytes + x * 4;
         const alpha = rgba.readUInt8(src + 3);
         pixels[dst] = rgba.readUInt8(src + 2);
         pixels[dst + 1] = rgba.readUInt8(src + 1);
         pixels[dst + 2] = rgba.readUInt8(src);
         pixels[dst + 3] = alpha;
         if (alpha === 0) {
            const at = y * maskRowBytes + (x >> 3);
            mask.writeUInt8(mask.readUInt8(at) | (0x80 >> (x & 7)), at);
         }
      }
   }
   return Buffer.concat([header, pixels, mask]);
};

const buildIco = (entries: { size: number; data: Buffer }[]): Buffer => {
   const dir = Buffer.alloc(6);
   dir.writeUInt16LE(0, 0);
   dir.writeUInt16LE(1, 2);
   dir.writeUInt16LE(entries.length, 4);
   let offset = 6 + 16 * entries.length;
   const dirEntries = entries.map(({ size, data }) => {
      const b = Buffer.alloc(16);
      b.writeUInt8(size === 256 ? 0 : size, 0);
      b.writeUInt8(size === 256 ? 0 : size, 1);
      b.writeUInt16LE(1, 4);
      b.writeUInt16LE(32, 6);
      b.writeUInt32LE(data.length, 8);
      b.writeUInt32LE(offset, 12);
      offset += data.length;
      return b;
   });
   return Buffer.concat([dir, ...dirEntries, ...entries.map((e) => e.data)]);
};

const ICON_SIZES = [192, 512];

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
   icons: (["any", "maskable"] as const).flatMap((purpose) =>
      ICON_SIZES.map((size) => ({
         src: `/icon-${purpose === "maskable" ? "maskable-" : ""}${size}.png`,
         sizes: `${size}x${size}`,
         type: "image/png",
         purpose,
      }))
   ),
};

const main = async () => {
   const mark = parseMark(await readFile(SOURCE_SVG, "utf8"));

   const files = new Map<string, Buffer | string>();

   files.set("favicon.svg", buildSvg(mark, TAB));

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

   files.set("favicon-96x96.png", await renderPng(buildSvg(mark, TAB, 96)));

   files.set(
      "apple-touch-icon.png",
      await renderPng(buildSvg(mark, PADDED, 180))
   );

   for (const size of ICON_SIZES) {
      files.set(`icon-${size}.png`, await renderPng(buildSvg(mark, TAB, size)));
      files.set(
         `icon-maskable-${size}.png`,
         await renderPng(buildSvg(mark, PADDED, size))
      );
   }

   files.set("site.webmanifest", JSON.stringify(MANIFEST, null, 3) + "\n");

   for (const dir of OUT_DIRS) {
      for (const [name, contents] of files) {
         await writeFile(path.join(dir, name), contents);
      }
   }

   for (const name of MIRRORED_SVGS) {
      const target = path.join(WEB_PUBLIC, name);
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(path.join(LANDING_PUBLIC, name), target);
   }

   console.table(
      [...files].map(([name, contents]) => ({
         file: name,
         bytes: Buffer.byteLength(contents),
      }))
   );
   console.log(
      `Wrote ${files.size} files into:\n${OUT_DIRS.map((d) => `  ${path.relative(REPO_ROOT, d)}`).join("\n")}\n` +
         `Mirrored ${MIRRORED_SVGS.length} logo files into ${path.relative(REPO_ROOT, WEB_PUBLIC)}`
   );
};

main().catch((err) => {
   console.error(err);
   process.exit(1);
});
