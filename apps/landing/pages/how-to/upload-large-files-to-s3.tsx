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
   "S3 Viewer streams large files through its server into multipart uploads without bucket CORS setup. AWS S3 and R2 uploads protect existing files; other endpoints must support the same protections. B2 uploads are currently blocked. Replacements require confirmation and readable original permissions and settings. New files may retry network failures; uncertain replacements require fresh review. The default app upload limit is 5 GiB and can be configured when self-hosting.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: Upload → Upload files, or drag files onto the list",
      body: (
         <>
            Open the <strong>Upload</strong> menu and choose{" "}
            <strong>Upload files</strong> (or <strong>Upload folder</strong>),
            or drag files straight onto the file list. Your browser sends each
            file to the S3 Viewer server, which streams it into the bucket as a
            multipart upload without writing it to disk. AWS S3 and R2 are
            supported; other endpoints must enforce the same overwrite
            protections. B2 uploads are blocked. No bucket CORS policy is
            needed. Existing files require confirmation and readable settings
            before replacement; some MinIO setups cannot provide those settings.
         </>
      ),
   },
   {
      title: "Review uncertain results before replacing a file",
      body: (
         <>
            New-file uploads can retry a lost browser connection while still
            protecting existing objects. Replacements are not automatically
            retried after an uncertain result: refresh and review first. Three
            files upload at once, and you can cancel them. The server attempts
            to remove unfinished parts when an upload fails or is cancelled.
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
         "S3 Viewer's default upload limit is 5 GiB per file. A self-hosted instance can change MAX_UPLOAD_BYTES, subject to the app's multipart and provider limits. Large files stream in parts; B2 uploads are currently blocked.",
   },
   {
      question: "What is multipart upload in S3?",
      answer:
         "A three-step S3 API flow — CreateMultipartUpload, UploadPart (in parallel, 5 MB minimum each, up to 10,000 parts), and CompleteMultipartUpload. It splits a large file into pieces, uploads them in parallel, and lets you retry only the failed parts. Required for anything over 5 GB; recommended for anything over 100 MB.",
   },
   {
      question: "What happens if my upload fails halfway?",
      answer:
         "S3 Viewer may resend a new-file upload after a browser network error, while keeping protection against overwriting an existing file. An uncertain replacement requires fresh review instead of automatic retry. Failed uploads attempt to clean up unfinished parts; a bucket cleanup policy helps cover interruptions where cleanup could not be confirmed.",
   },
   {
      question: "Do I get charged for failed multipart uploads?",
      answer:
         "Yes — incomplete multipart uploads are stored and billed at standard storage rates until you abort them. Set an S3 lifecycle rule to auto-abort incomplete uploads after a few days.",
   },
   {
      question: "Does Cloudflare R2 support multipart upload?",
      answer:
         "Yes. S3 Viewer supports multipart uploads to R2 and protects against overwriting an unreviewed file. Replacements require readable original settings; R2 object rename and deletion remain blocked.",
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
         retry only the failed parts. S3 Viewer uses multipart upload for large
         files and a single upload for small files. Both travel through the
         server without writing file contents to disk or requiring bucket CORS
         setup. AWS S3 and R2 support the app&apos;s overwrite protections;
         other endpoints must enforce those protections too. B2 uploads are
         blocked. Replacement requires readable original permissions and
         settings, so unsupported encryption or unavailable settings stop it
         before the existing file is changed.
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
