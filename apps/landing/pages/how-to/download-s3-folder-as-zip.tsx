import {
   createHowToPage,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import type { Faq } from "@/lib/types";
import { DownloadIllustration } from "@/components/UseCases/illustrations/how-to/download";

const SLUG = "download-s3-folder-as-zip";
const TLDR =
   "S3 has no folder-download endpoint and no server-side zip — a folder is just a shared key prefix, and every object under it has to be fetched individually. The AWS CLI's aws s3 sync pulls the whole tree to disk; S3 Viewer's Download as zip instead streams each object straight into a zip archive and sends the finished file to your browser, without ever holding the whole thing in memory. It's capped by object count and total size so a request can't quietly try to zip an entire bucket.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: Download as zip",
      body: (
         <>
            Choose <strong>Download as zip</strong> from a folder row&apos;s ⋮
            menu, or select several files and folders and use it from the
            selection toolbar. S3 Viewer lists everything under the prefix(es),
            checks the total count and size are within limits, and then starts
            the download — the browser shows the usual save-file prompt once the
            archive is ready.
         </>
      ),
   },
   {
      title: "AWS CLI: sync the folder to disk, then zip it locally",
      body: (
         <>
            <code>aws s3 sync</code> mirrors the prefix to a local directory;
            zip it yourself once it&apos;s down. This downloads every object
            individually to your machine before anything is archived.
         </>
      ),
      code: `aws s3 sync s3://my-bucket/reports/2026/ ./2026
cd .. && zip -r 2026.zip 2026`,
   },
   {
      title: "SDK: list, get each object, stream into an archive",
      body: (
         <>
            Any zip library that accepts a stream can be fed one{" "}
            <code>GetObject</code> body at a time as you page through{" "}
            <code>ListObjectsV2</code> — this is the same shape S3 Viewer&apos;s
            server-side archive route runs, minus the size and count checks.
         </>
      ),
      code: `const archive = archiver('zip', { zlib: { level: 0 } });
archive.pipe(outputStream);

for await (const key of listAllKeys(bucket, prefix)) {
  const { Body } = await s3.getObject({ Bucket: bucket, Key: key });
  archive.append(Body, { name: key.slice(prefix.length) });
}
await archive.finalize();`,
   },
   {
      title: "Why S3 Viewer stores rather than compresses",
      body: (
         <>
            The archive is built with zip&apos;s store method (no compression),
            since most object storage already holds compressed formats (images,
            video, PDFs) where re-compressing wastes CPU for negligible size
            savings. The trade-off is a larger zip than a deflate-compressed one
            would produce for genuinely compressible content, in exchange for a
            much faster archive.
         </>
      ),
   },
   {
      title: "Limits exist so a zip can't quietly become a whole bucket",
      body: (
         <>
            A folder with more objects than <code>MAX_ARCHIVE_OBJECTS</code>{" "}
            (10,000 by default) or more total bytes than{" "}
            <code>MAX_ARCHIVE_BYTES</code> (10 GiB by default) is refused up
            front, before any object is read, with a message naming which limit
            was hit. An operator self-hosting S3 Viewer can raise both via
            environment variables.
         </>
      ),
   },
];

const faqs: Faq[] = [
   {
      question: "Can I download an entire S3 folder as one zip file?",
      answer:
         "Not with a single native S3 call — there's no folder-download or server-side-zip API. The AWS console downloads a folder as separate files or, in some regions, offers a batch download that still fetches objects individually behind the scenes. S3 Viewer's Download as zip button does the equivalent from the browser: it lists everything under the prefix, streams each object into an archive, and sends you one file, bounded by an object-count and total-size limit.",
   },
   {
      question: "Does S3 have a native zip download feature?",
      answer:
         "No. S3 stores objects, not archives, and has no endpoint that returns a compressed bundle of a prefix. Every zip-a-folder feature — the AWS console's, a third-party tool's, or S3 Viewer's — builds the archive itself by reading the individual objects.",
   },
   {
      question: "How do I download a folder from S3 using the AWS CLI?",
      answer:
         "aws s3 sync s3://bucket/prefix/ ./local-folder mirrors the prefix to disk as individual files, preserving the relative paths. Zip it afterward with your OS's zip tool if you want a single file; the CLI itself has no zip option.",
   },
   {
      question: "Is there a size limit on zip downloads in S3 Viewer?",
      answer:
         "Yes, two: MAX_ARCHIVE_OBJECTS (default 10,000 objects) and MAX_ARCHIVE_BYTES (default 10 GiB total, checked against the objects' listed sizes before anything downloads). Both are checked up front and both are configurable by whoever self-hosts the instance. A folder over either limit is refused with a message naming which one.",
   },
   {
      question:
         "What happens if an object fails to download partway through the zip?",
      answer:
         "The whole archive is aborted rather than finished with a gap — S3 Viewer ends the response without writing a valid zip central directory, so the download comes through as a truncated, unopenable file instead of a zip that looks complete but is silently missing an object.",
   },
   {
      question: "Does the zip download work the same way on R2, B2 and MinIO?",
      answer:
         "Yes. Building the archive only needs ListObjectsV2 and GetObject, which every S3-compatible provider implements the same way, so the zip feature has no provider-specific behavior at all.",
   },
];

export default createHowToPage({
   slug: SLUG,
   tldr: TLDR,
   seoTitle: "How to Download an S3 Folder as a Zip File",
   seoDescription:
      "S3 has no folder-download or server-side zip API. Here's how S3 Viewer streams a folder into a single zip file, with object-count and size limits.",
   published: "2026-09-07",
   updated: "2026-10-12",
   visual: <DownloadIllustration />,
   steps,
   underTheHood: (
      <>
         <p>
            A prefix isn&apos;t a container S3 can hand you as one unit —
            it&apos;s a filter over a flat list of keys. Turning it into a
            single downloadable file means listing every key under it, reading
            each object&apos;s body, and writing all of them into an archive
            format, which is exactly what S3 Viewer&apos;s{" "}
            <code>/v3/archive</code> route does: <code>ListObjectsV2</code> to
            expand any folder keys recursively, then one <code>GetObject</code>{" "}
            per file streamed straight into a zip being written to the response
            — nothing is buffered on disk or held fully in memory.
         </p>
         <p>
            Because building the archive can take a while and touches many
            objects, the route checks the total object count and byte size
            against configured limits before it starts streaming anything, and
            returns a short-lived, user-bound download token rather than the
            file itself — the actual archive is fetched with a second request
            against that token, which is what lets the browser show a normal
            save dialog instead of the page navigating away mid-download.
         </p>
         <p>
            The archive uses zip&apos;s store method — no deflate compression —
            partly for speed and partly because most object storage already
            holds pre-compressed formats. <code>zip64</code> is enabled so the
            format itself has no 4 GiB or 65,535-file ceiling; the configured{" "}
            <code>MAX_ARCHIVE_BYTES</code> and <code>MAX_ARCHIVE_OBJECTS</code>{" "}
            are what actually bound a request, and both exist to keep one
            download from turning into an unbounded read of an entire bucket.
         </p>
      </>
   ),
   faqs,
   useCases: ["s3-browser", "cloudflare-r2"],
   related: [
      "upload-large-files-to-s3",
      "download-file-from-s3",
      "bulk-delete-s3-files",
   ],
});
