import { getRelatedHowTos } from "@/components/HowTo/data";
import {
   createHowToPage,
   type HowToFAQ,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import { getUseCaseRefs } from "@/components/UseCases/data";
import { UploadIllustration } from "@/components/UseCases/illustrations";

const SLUG = "upload-large-files-to-s3";
const TITLE = "How to upload large files to S3 (multipart upload)";
const KEYWORD = "upload large files to S3";
const TLDR =
   "Amazon S3's single PutObject caps at 5 GB and is non-resumable — a network blip on a 4 GB upload restarts from byte zero. The S3 multipart upload API (5 MB minimum part, 10,000 max parts, 5 TB ceiling) splits the file into pieces, uploads them in parallel, and lets you retry only the failed parts. S3 Viewer streams every upload through its own server into your bucket as a multipart upload — 25 MB parts, four in flight, the whole request retried on a network error — so nothing needs configuring on the bucket and your access key never leaves the server.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: Upload → Upload files, or drag files onto the list",
      body: (
         <>
            Open the <strong>Upload</strong> menu and choose{" "}
            <strong>Upload files</strong> (or <strong>Upload folder</strong>),
            or drag files straight onto the file list. Your browser sends each
            file to the S3 Viewer server, which streams it into the bucket as a
            multipart upload — <strong>25 MB parts</strong>, four in flight,
            nothing written to disk — on S3, R2, MinIO or any other
            S3-compatible provider. The bucket needs no CORS policy or other
            setting for this to work.
         </>
      ),
   },
   {
      title: "Network errors are retried; nothing is left half-written",
      body: (
         <>
            If your connection to S3 Viewer drops, the file is re-sent up to two
            more times; three files upload at once and you can cancel any of
            them. Whenever an upload stops early — a cancel, a dropped
            connection, a storage error — the server aborts the multipart upload
            in the bucket, so no orphaned parts are stored or billed.
         </>
      ),
   },
   {
      title: "AWS CLI: aws s3 cp",
      body: (
         <>
            The CLI uses multipart automatically above 8 MB. No flags needed for
            normal files; tune <code>multipart_chunksize</code> in your AWS
            config for very large ones.
         </>
      ),
      code: "aws s3 cp big.zip s3://bucket/big.zip",
   },
   {
      title: "AWS SDK: Upload from @aws-sdk/lib-storage",
      body: (
         <>
            Handles part splitting, parallelism, and retries for you. The right
            pattern for streaming uploads from a backend.
         </>
      ),
      code: "import { Upload } from '@aws-sdk/lib-storage';\n\nconst u = new Upload({\n  client: s3,\n  params: { Bucket: 'b', Key: 'big.zip', Body: stream },\n  queueSize: 4,    // parts in flight\n  partSize: 8 * 1024 * 1024,\n});\nawait u.done();",
   },
   {
      title: "Tune part size for very large files",
      body: (
         <>
            Default <code>partSize</code> in the SDK is 5 MB; raise to 64–100 MB
            for files over 50 GB so you don&apos;t hit the 10,000-parts cap.
            Math: max object size = partSize × 10,000.
         </>
      ),
   },
   {
      title: "Verify with HeadObject",
      body: (
         <>
            After the upload completes, confirm the size and ETag match what you
            intended to upload.
         </>
      ),
      code: "aws s3api head-object --bucket b --key big.zip",
   },
   {
      title: "Set a lifecycle rule to abort failed uploads",
      body: (
         <>
            Incomplete multipart uploads sit in the bucket and you pay for them
            until aborted. Add an S3 lifecycle rule to auto-abort uploads older
            than a few days — AWS recommends this in the well-architected
            framework.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "What's the max file size I can upload to S3?",
      answer:
         "5 GB with a single PutObject; 5 TB per object with multipart upload (10,000 parts × 5 GB each). S3 Viewer streams uploads to the bucket in 25 MB parts, so the multipart limits apply rather than the 5 GB single-PUT cap; a self-hosted instance can cap uploads with MAX_UPLOAD_BYTES.",
   },
   {
      question: "What is multipart upload in S3?",
      answer:
         "A three-step S3 API flow — CreateMultipartUpload, UploadPart (in parallel, 5 MB minimum each, up to 10,000 parts), and CompleteMultipartUpload. It splits a large file into pieces, uploads them in parallel, and lets you retry only the failed parts. Required for anything over 5 GB; recommended for anything over 100 MB.",
   },
   {
      question: "What happens if my upload fails halfway?",
      answer:
         "With single PutObject, you start over from byte zero. With multipart upload, only the failed parts retry — completed parts stay completed. In S3 Viewer the server-side leg to the bucket retries parts on its own; if the connection from your browser to S3 Viewer drops, the file is re-sent up to two more times, and the aborted multipart upload is cleaned up in the bucket first.",
   },
   {
      question: "Do I get charged for failed multipart uploads?",
      answer:
         "Yes — incomplete multipart uploads are stored and billed at standard storage rates until you abort them. Set an S3 lifecycle rule to auto-abort incomplete uploads after a few days.",
   },
   {
      question: "Does Cloudflare R2 support multipart upload?",
      answer:
         "Yes. R2 implements the same S3 multipart upload API. The same multipart pattern (and the same SDKs) works against R2 buckets without changes — Cloudflare's S3 compatibility is what makes this possible.",
   },
   {
      question: "How do I upload large files to S3 from a browser safely?",
      answer:
         "Keep the credential on a server. Either the browser sends the file to your server, which streams it into the bucket with lib-storage's Upload (what S3 Viewer does — the bucket needs no CORS policy and the key never reaches the client), or your backend issues presigned URLs per part and the browser PUTs to them directly, which needs a CORS rule on the bucket allowing your origin.",
   },
];

export default createHowToPage({
   slug: SLUG,
   title: TITLE,
   tldr: TLDR,
   keyword: KEYWORD,
   seoTitle: "How to Upload Large Files to S3 (Multipart, Browser, CLI)",
   seoDescription:
      "Use S3 multipart upload for files over 100 MB. Parts upload in parallel, failed parts retry independently, and objects up to 5 TB are supported.",
   visual: <UploadIllustration />,
   steps,
   underTheHood: (
      <p>
         S3&apos;s <code>PutObject</code> caps at 5 GB and is non-resumable — a
         network blip on a 4 GB upload restarts from byte zero. Multipart upload
         (<code>CreateMultipartUpload</code> → many <code>UploadPart</code> →{" "}
         <code>CompleteMultipartUpload</code>) splits the file into parts (5 MB
         minimum, 10,000 parts max), uploads them in parallel, and lets you
         retry only the failed parts. It supports objects up to 5 TB. S3 Viewer
         uploads every file this way: your browser streams it to the S3 Viewer
         server, which cuts it into 25 MB parts and sends four at a time to the
         bucket while the rest is still arriving — nothing buffered to disk, and
         the upload aborted in the bucket if the stream stops early. Because the
         browser never talks to the bucket, there is no CORS policy to set. The
         same pattern works against Cloudflare R2, MinIO, B2, and any other
         S3-compatible provider.
      </p>
   ),
   faqs,
   useCases: getUseCaseRefs(["s3-browser", "cloudflare-r2"]),
   related: getRelatedHowTos([
      "download-file-from-s3",
      "create-folder-in-s3",
      "delete-file-from-s3",
   ]),
});
