import { createRequire } from "node:module";
import { readdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(REPO_ROOT, "apps/landing/public");
const LOTTIE_FILE = path.join(PUBLIC_DIR, "landing/serverconnect.json");
const PLACEHOLDERS_FILE = path.join(
   REPO_ROOT,
   "apps/landing/components/Landing/image-placeholders.ts"
);

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
         "sharp not found under node_modules/.pnpm. It's already declared in " +
            "pnpm-workspace.yaml's onlyBuiltDependencies — run `pnpm install` " +
            "at the repo root (this script must not add it as a new dependency)."
      );
   }
   return require(path.join(pnpmDir, entry, "node_modules/sharp"));
};

const sharp = resolveSharp();

// Target widths are physical (retina, 2x) pixel widths, measured from the
// actual rendered CSS width of each <Image> across breakpoints (375–1920px)
// in a live browser, not guessed from layout classes. See PR description /
// agent report for the measurements. Never upscale past a file's native size.
type RasterAsset = {
   file: string; // relative to apps/landing/public
   targetWidth: number;
};

const RASTER_ASSETS: RasterAsset[] = [
   { file: "landing/profiles/vinit.png", targetWidth: 96 },
   { file: "landing/profiles/mike.png", targetWidth: 96 },
   { file: "landing/profiles/aleem.png", targetWidth: 96 },
   { file: "landing/profiles/noah.png", targetWidth: 96 },
   { file: "landing/bucketview.png", targetWidth: 2048 },
   { file: "landing/objectview.png", targetWidth: 2208 },
   { file: "landing/serverselect.png", targetWidth: 640 },
];

const LQIP_WIDTH = 20;

type Report = {
   file: string;
   beforeBytes: number;
   afterBytes: number;
   beforeDims: string;
   afterDims: string;
   note: string;
};

const fmtBytes = (n: number) => {
   if (n < 1024) return `${n} B`;
   if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
   return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

// palette:false keeps this a lossless deflate recompression — sharp's PNG
// `effort` option implicitly enables palette quantisation, so it's left unset.
const recompressPng = (buf: Buffer) =>
   sharp(buf).png({ compressionLevel: 9, palette: false }).toBuffer();

const optimizeRaster = async (asset: RasterAsset): Promise<Report> => {
   const filePath = path.join(PUBLIC_DIR, asset.file);
   const before = await readFile(filePath);
   const beforeMeta = await sharp(before).metadata();
   const beforeDims = `${beforeMeta.width}x${beforeMeta.height}`;

   // Try both a resize+recompress and a recompress-only pass and keep
   // whichever is smaller: downscaling a screenshot can add anti-aliasing
   // noise along every edge that costs deflate more than the pixel-count
   // drop saves, so resizing isn't always the win it looks like on paper.
   const candidates: { buf: Buffer; label: string }[] = [];
   if (beforeMeta.width && beforeMeta.width > asset.targetWidth) {
      const resized = await sharp(before)
         .resize({ width: asset.targetWidth, withoutEnlargement: true })
         .png({ compressionLevel: 9, palette: false })
         .toBuffer();
      candidates.push({ buf: resized, label: "resized + recompressed" });
   }
   candidates.push({
      buf: await recompressPng(before),
      label: "recompressed only (resize did not shrink it further)",
   });

   let best: { buf: Buffer; label: string } | null = null;
   for (const candidate of candidates) {
      if (
         candidate.buf.length < before.length &&
         (!best || candidate.buf.length < best.buf.length)
      ) {
         best = candidate;
      }
   }

   if (!best) {
      return {
         file: asset.file,
         beforeBytes: before.length,
         afterBytes: before.length,
         beforeDims,
         afterDims: beforeDims,
         note: "skipped (already optimal — no candidate beat the current file)",
      };
   }

   const afterMeta = await sharp(best.buf).metadata();
   await writeFile(filePath, best.buf);
   return {
      file: asset.file,
      beforeBytes: before.length,
      afterBytes: best.buf.length,
      beforeDims,
      afterDims: `${afterMeta.width}x${afterMeta.height}`,
      note: best.label,
   };
};

const buildLqip = async (relFile: string): Promise<string> => {
   const filePath = path.join(PUBLIC_DIR, relFile);
   const buf = await readFile(filePath);
   const lqip = await sharp(buf)
      .resize({ width: LQIP_WIDTH })
      .webp({ quality: 45 })
      .toBuffer();
   return `data:image/webp;base64,${lqip.toString("base64")}`;
};

const optimizeLottie = async (): Promise<Report> => {
   const before = await readFile(LOTTIE_FILE, "utf8");
   const data = JSON.parse(before) as Record<string, unknown>;

   const metadata = data.metadata as Record<string, unknown> | undefined;
   if (metadata) delete metadata.lottielabInfoHTML;

   const after = JSON.stringify(data);

   if (Buffer.byteLength(after) >= Buffer.byteLength(before)) {
      return {
         file: "landing/serverconnect.json",
         beforeBytes: Buffer.byteLength(before),
         afterBytes: Buffer.byteLength(before),
         beforeDims: "-",
         afterDims: "-",
         note: "skipped (minified output was not smaller)",
      };
   }

   await writeFile(LOTTIE_FILE, after);
   return {
      file: "landing/serverconnect.json",
      beforeBytes: Buffer.byteLength(before),
      afterBytes: Buffer.byteLength(after),
      beforeDims: "-",
      afterDims: "-",
      note: "whitespace stripped + editor-only metadata dropped (lossless)",
   };
};

const writePlaceholdersModule = async (entries: [string, string][]) => {
   const lines = entries
      .map(([publicPath, dataUri]) => `   "${publicPath}": "${dataUri}",`)
      .join("\n");
   const contents = `// GENERATED by scripts/optimize-landing-assets.ts — do not hand-edit.
// Tiny blurred placeholders for next/image's placeholder="blur", keyed by
// the public path passed to <Image src>.
export const IMAGE_PLACEHOLDERS: Record<string, string> = {
${lines}
};
`;
   await writeFile(PLACEHOLDERS_FILE, contents);
};

const printReport = (reports: Report[]) => {
   const rows = reports.map((r) => ({
      file: r.file,
      before: `${fmtBytes(r.beforeBytes)} (${r.beforeDims})`,
      after: `${fmtBytes(r.afterBytes)} (${r.afterDims})`,
      saved:
         r.beforeBytes > 0
            ? `${(100 - (r.afterBytes / r.beforeBytes) * 100).toFixed(0)}%`
            : "0%",
      note: r.note,
   }));
   console.table(rows);

   const totalBefore = reports.reduce((sum, r) => sum + r.beforeBytes, 0);
   const totalAfter = reports.reduce((sum, r) => sum + r.afterBytes, 0);
   console.log(
      `Total: ${fmtBytes(totalBefore)} -> ${fmtBytes(totalAfter)} ` +
         `(${fmtBytes(totalBefore - totalAfter)} saved, ` +
         `${(100 - (totalAfter / totalBefore) * 100).toFixed(1)}%)`
   );
};

const main = async () => {
   const rasterReports: Report[] = [];
   for (const asset of RASTER_ASSETS) {
      rasterReports.push(await optimizeRaster(asset));
   }

   const lottieReport = await optimizeLottie();

   const lqipEntries: [string, string][] = [];
   for (const asset of RASTER_ASSETS) {
      const publicPath = `/${asset.file}`;
      lqipEntries.push([publicPath, await buildLqip(asset.file)]);
   }
   await writePlaceholdersModule(lqipEntries);

   printReport([...rasterReports, lottieReport]);
   console.log(
      `\nWrote LQIP placeholders for ${lqipEntries.length} images to ` +
         path.relative(REPO_ROOT, PLACEHOLDERS_FILE)
   );
};

main().catch((err) => {
   console.error(err);
   process.exitCode = 1;
});
