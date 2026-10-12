import {
   createHowToPage,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import type { Faq } from "@/lib/types";
import { UploadIllustration } from "@/components/UseCases/illustrations/how-to/upload";

const SLUG = "upload-large-files-to-s3";
const TLDR =
   "S3 Viewer streams large files through its server into multipart uploads without bucket CORS setup, on AWS S3, Cloudflare R2, Backblaze B2, and other S3-compatible endpoints alike. Uploads protect existing files: AWS S3 and R2 enforce the condition directly, other endpoints get a HEAD check performed by S3 Viewer immediately before the write. Replacements require confirmation and readable original permissions and settings. New files may retry network failures; uncertain replacements require fresh review. The default app upload limit is 5 GiB and can be configured when self-hosting.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: Upload → Upload files, or drag files onto the list",
      body: (
         <>
            Open the <strong>Upload</strong> menu and choose{" "}
            <strong>Upload files</strong> (or <strong>Upload folder</strong>),
            or drag files straight onto the file list. Your browser sends each
            file through the S3 Viewer server into the bucket without writing it
            to disk. This works on AWS S3, R2, B2, and other S3-compatible
            endpoints. No bucket CORS policy is needed. Existing files require
            confirmation and readable settings before replacement; some MinIO
            setups cannot provide those settings, in which case replacement is
            refused rather than guessed at.
         </>
      ),
   },
   {
      title: "Review uncertain results before replacing a file",
      body: (
         <>
            New-file uploads can retry a lost browser connection while still
            protecting existing objects. Replacements are not automatically
            retried after an uncertain result: refresh and review first.
            Interrupted browser multipart uploads retain their parts for
            resumption. Failed single-request uploads and cancellations attempt
            to remove unfinished parts, but cleanup can fail.
         </>
      ),
   },
   {
      title: "AWS CLI: aws s3 cp",
      body: (
         <>
            The CLI uses multipart automatically for large files. No flags
            needed for normal files; tune <code>multipart_chunksize</code> in
            your AWS config for very large ones.
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
            Choose a <code>partSize</code> that stays within AWS S3&apos;s
            10,000-part limit. For a fixed part size,{" "}
            <code>partSize × 10,000</code> is the part-count ceiling; the
            effective upload limit is the lowest applicable part-count,
            operator, application, or provider limit.
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

const faqs: Faq[] = [
   {
      question: "What's the max file size I can upload to S3?",
      answer:
         "S3 Viewer's default upload limit is 5 GiB per file. A self-hosted instance can change MAX_UPLOAD_BYTES, subject to the app's multipart and provider limits. Large files stream in parts on every connected provider, including B2.",
   },
   {
      question: "What is multipart upload in S3?",
      answer:
         "A three-step S3 API flow — CreateMultipartUpload, UploadPart (in parallel, at least 5 MiB per part except the final part, up to 10,000 parts on AWS S3), and CompleteMultipartUpload. It splits a large file into pieces, uploads them in parallel, and lets you retry only the failed parts. It is useful for large files and uploads that need retries.",
   },
   {
      question: "What happens if my upload fails halfway?",
      answer:
         "S3 Viewer may retry a new-file upload after a browser network error, while keeping protection against overwriting an existing file. An uncertain replacement requires fresh review. Interrupted browser multipart uploads retain their parts and saved session so you can resume them. Failed single-request uploads and cancellations attempt cleanup; a bucket lifecycle rule can remove abandoned parts when cleanup fails or an upload is never resumed.",
   },
   {
      question: "Do I get charged for failed multipart uploads?",
      answer:
         "Yes — incomplete multipart uploads are stored and billed at standard storage rates until you abort them. Set an S3 lifecycle rule to auto-abort incomplete uploads after a few days.",
   },
   {
      question: "Does Cloudflare R2 support multipart upload?",
      answer:
         "Yes. S3 Viewer supports multipart uploads to R2 and protects against overwriting an unreviewed file. Replacements require readable original settings, and R2 object rename and deletion both work the same way they do on AWS S3.",
   },
   {
      question: "How do I upload large files to S3 from a browser safely?",
      answer:
         "Keep the credential on a server. S3 Viewer sends smaller files in a single API request to the server's streaming uploader. For larger files, the browser coordinates multipart uploads and sends each part through the API into the bucket. Neither path exposes credentials or requires bucket CORS changes. In your own app, presigned URLs per part are another option, but direct browser requests to S3 need a CORS rule allowing your origin.",
   },
];

export default createHowToPage({
   slug: SLUG,
   heading: "How to upload large files to S3 (multipart upload)",
   tldr: TLDR,
   seoTitle: "Upload Large Files to S3 (Multipart + CLI)",
   seoDescription:
      "Learn how multipart uploads split large files into parts, how S3 Viewer transfers them through its server, and which instance and provider limits apply.",
   published: "2026-04-28",
   visual: <UploadIllustration />,
   steps,
   underTheHood: (
      <p>
         S3&apos;s <code>PutObject</code> sends an object in a single request
         that cannot be resumed — a network interruption restarts the upload
         from byte zero. Multipart upload (<code>CreateMultipartUpload</code> →
         many <code>UploadPart</code> → <code>CompleteMultipartUpload</code>)
         splits the file into parts (at least 5 MiB each except the final part,
         up to 10,000 parts on AWS S3), uploads them in parallel, and lets you
         retry only the failed parts. S3 Viewer uses multipart upload for large
         files and a single upload for small files. Both travel through the
         server without writing file contents to disk or requiring bucket CORS
         setup, on every connected provider. AWS S3 and R2 enforce the
         app&apos;s overwrite protections directly; B2 and other endpoints get
         the same check performed by S3 Viewer with a HEAD request immediately
         before the write. Replacement requires readable original permissions
         and settings, so unsupported encryption or unavailable settings stop it
         before the existing file is changed.
      </p>
   ),
   faqs,
   useCases: ["s3-browser", "cloudflare-r2"],
   related: [
      "download-file-from-s3",
      "create-folder-in-s3",
      "delete-file-from-s3",
   ],
});
