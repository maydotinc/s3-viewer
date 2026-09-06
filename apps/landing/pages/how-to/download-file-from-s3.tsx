import {
   createHowToPage,
   type HowToFAQ,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import { getRelatedHowTos } from "@/components/HowTo/data";
import { getUseCaseRefs } from "@/components/UseCases/data";
import { DownloadIllustration } from "@/components/UseCases/illustrations";

const SLUG = "download-file-from-s3";
const TITLE = "How to download a file from S3";
const KEYWORD = "download file from S3";
const TLDR =
   "Three patterns. In S3 Viewer, open the ⋮ menu on the row and choose Download (a 15-minute presigned URL is signed server-side, so your AWS keys never reach the browser, and the file saves under the last segment of its object key). Run aws s3 cp s3://bucket/key ./ from a terminal. Or send someone a presigned URL — Copy link in the same menu — when they don't have AWS access.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: ⋮ → Download",
      body: (
         <>
            Open the ⋮ menu on the object&apos;s row and choose{" "}
            <strong>Download</strong>. The browser fetches the file straight
            from your bucket via a 15-minute presigned URL signed server-side
            with your encrypted credentials — the bytes never pass through our
            servers and your access key never reaches the client. The file saves
            under the last segment of its object key, so{" "}
            <code>reports/2026/q4.pdf</code> lands on disk as{" "}
            <code>q4.pdf</code>.
         </>
      ),
   },
   {
      title: "AWS CLI: aws s3 cp (single file)",
      body: <>For one file. Streams directly to disk.</>,
      code: "aws s3 cp s3://my-bucket/path/to/file.pdf ./",
   },
   {
      title: "AWS CLI: aws s3 sync (whole prefix)",
      body: (
         <>
            Mirrors a prefix to a local directory and skips files you already
            have. The right pattern for backups or local development.
         </>
      ),
      code: "aws s3 sync s3://my-bucket/reports/ ./reports/",
   },
   {
      title: "AWS SDK: GetObject",
      body: (
         <>
            For a backend, stream the response body to a file or to a response
            stream.
         </>
      ),
      code: "const obj = await s3.getObject({\n  Bucket: 'my-bucket',\n  Key: 'file.pdf',\n});\nawait pipeline(obj.Body, fs.createWriteStream('./file.pdf'));",
   },
   {
      title: "Sharing: presigned URL for someone without AWS",
      body: (
         <>
            Use <strong>Copy link</strong> in the row&apos;s ⋮ menu, or run{" "}
            <code>aws s3 presign</code>. Same primitive — works in any browser,
            expires when you say (15 minutes from S3 Viewer). Treat it as a
            bearer token.
         </>
      ),
      code: "aws s3 presign s3://my-bucket/file.pdf --expires-in 3600",
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "How do I download a file from an S3 bucket?",
      answer:
         "Easiest: open S3 Viewer in a browser, open the ⋮ menu on the file's row and choose Download — it fetches via a server-signed presigned URL and saves the file under the last segment of its object key. From a terminal: aws s3 cp s3://bucket/key ./. From an SDK: call GetObject and pipe the response body to a file. To share with someone who doesn't have AWS access: use Copy link in the same ⋮ menu, or aws s3 presign.",
   },
   {
      question: "How do I download an entire S3 prefix or folder?",
      answer:
         "From the AWS CLI: aws s3 sync s3://bucket/prefix ./local-dir — it mirrors the prefix and skips files already on disk. Programmatically: list the prefix with ListObjectsV2 and GetObject each key in parallel.",
   },
   {
      question: "How do I download a file from someone else's S3 bucket?",
      answer:
         "If they sent you a presigned URL, paste it in any browser — it works without an AWS account until it expires. If they invited you to S3 Viewer, sign in and download from the file browser. If they granted your AWS account cross-account access, use your own AWS CLI as normal.",
   },
   {
      question: "Why do my AWS keys never reach the client in S3 Viewer?",
      answer:
         "S3 Viewer signs every request server-side, then hands the browser a short-lived presigned URL to fetch. Your access key and secret are encrypted in your browser before they ever reach us and are only decrypted to run the operation you asked for; only a 15-minute signed URL reaches the client. Even if someone intercepts that URL, it expires fast and grants only that one operation.",
   },
   {
      question: "Can I download from Cloudflare R2 the same way?",
      answer:
         "Yes. R2 implements the S3 GetObject API and presigned URLs. The AWS CLI works against R2 with --endpoint-url; S3 Viewer's download flow is identical for R2 and AWS S3.",
   },
];

export default createHowToPage({
   slug: SLUG,
   title: TITLE,
   tldr: TLDR,
   keyword: KEYWORD,
   seoTitle: "How to Download a File From S3 (Browser, CLI, Presigned URL)",
   seoDescription:
      "Three ways to download from S3 — browser via S3 Viewer, AWS CLI, or presigned URL. S3 Viewer signs server-side so your keys never reach the client.",
   visual: <DownloadIllustration />,
   steps,
   underTheHood: (
      <p>
         A download is a <code>GetObject</code> API call. The CLI streams the
         response body to a local file; SDKs return a readable stream you pipe
         wherever you want; S3 Viewer signs a 15-minute presigned URL
         server-side using your encrypted credentials, names the download after
         the last segment of the object key, and the browser fetches that URL
         directly from your bucket — so your AWS keys never reach the client and
         the bytes never pass through our servers. Sharing with a non-AWS user
         is the same primitive: a presigned URL is just a signed query-string
         version of GetObject that anyone with the link can fetch until it
         expires.
      </p>
   ),
   faqs,
   useCases: getUseCaseRefs(["s3-browser"]),
   related: getRelatedHowTos([
      "fix-s3-access-denied",
      "share-s3-file-with-non-technical-user",
      "upload-large-files-to-s3",
   ]),
});
