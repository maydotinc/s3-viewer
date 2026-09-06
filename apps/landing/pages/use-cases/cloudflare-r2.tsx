import { getRelatedHowTos } from "@/components/HowTo/data";
import { getRelated } from "@/components/UseCases/data";
import { CloudflareR2Illustration } from "@/components/UseCases/illustrations";
import {
   createUseCasePage,
   type UseCaseFAQ,
   type UseCaseStep,
} from "@/components/UseCases/use-case-page";
import {
   Eye,
   Layers,
   PencilLine,
   Search,
   Upload,
   UserPlus,
} from "lucide-react";

const SLUG = "cloudflare-r2";
const TITLE = "A daily-use dashboard for Cloudflare R2.";
const KEYWORD = "Cloudflare R2 dashboard";
const META_DESCRIPTION =
   "A daily-use dashboard for Cloudflare R2: inline previews, streamed uploads with no bucket setup, email invites, and your AWS buckets in the same sidebar.";
const DESCRIPTION =
   "Cloudflare R2's S3-compatible API is excellent — it's what lets any S3 client talk to R2 the same way it talks to AWS S3. The Cloudflare dashboard is built around configuration; S3 Viewer is the layer for daily browsing on top: inline previews, streamed uploads that need no CORS policy on the bucket, email invites, and R2 in the same sidebar as your AWS buckets.";

const steps: UseCaseStep[] = [
   {
      title: "Generate an R2 API token",
      body: "In the Cloudflare dashboard, create an R2 API token scoped to the buckets you want to expose. Copy the access key ID, secret, and your account's S3 endpoint (account.r2.cloudflarestorage.com).",
   },
   {
      title: "Paste it in",
      body: "Click Add server, paste the key and secret, and enter the endpoint with auto as the region. No SDK config, no wrangler, no AWS CLI.",
   },
   {
      title: "Use R2 the way you'd use any bucket",
      body: "Filter a folder by prefix. Upload multi-GB files — they stream through S3 Viewer into R2 as a multipart upload, with no CORS policy to set on the bucket. Invite teammates by email — they don't need a Cloudflare account.",
   },
];

const faqs: UseCaseFAQ[] = [
   {
      question: "Is there a better dashboard for Cloudflare R2?",
      answer:
         "S3 Viewer is built for the daily browsing layer on top of R2. The Cloudflare dashboard is the right place to create buckets, manage R2 API tokens, configure custom domains, and handle billing. S3 Viewer adds inline file previews, a prefix filter inside each folder, uploads that stream through S3 Viewer with no bucket configuration, team sharing by email, and your AWS buckets one click away in the same sidebar.",
   },
   {
      question: "How do I rename a file in Cloudflare R2?",
      answer:
         "Use the Rename action in the file menu. S3 Viewer copies the object within R2, protects against replacing an existing destination, checks the copy and original, and then removes the original. If the operation cannot be confirmed, it asks you to check both names before proceeding.",
   },
   {
      question: "How do I search a Cloudflare R2 bucket?",
      answer:
         "R2 implements the S3 ListObjectsV2 API, the same as AWS. In S3 Viewer, the “Filter by prefix” box filters the folder you're in by prefix. For a recursive sweep, use the AWS CLI against R2 with --endpoint-url and pipe it through grep.",
   },
   {
      question:
         "Can I share a Cloudflare R2 bucket with someone who doesn't have a Cloudflare account?",
      answer:
         "Yes. Click Share, invite them by email and give them a role — Viewer (browse and download), Editor (also upload, delete and create buckets) or Admin (also manage members, rename the server and remove buckets). They sign in to S3 Viewer in a browser and see the bucket, with no Cloudflare account or API token of their own.",
   },
   {
      question: "Are large uploads to R2 reliable?",
      answer:
         "Yes. Your browser streams the file to S3 Viewer, which writes it to R2 through the S3-compatible multipart upload API in 25 MB parts, several at a time. A network error between your browser and S3 Viewer re-sends the file up to two more times, and an upload that stops early is aborted in R2 so no orphaned parts are billed. Nothing needs to be configured on the bucket — no CORS policy, no exposed headers.",
   },
   {
      question: "Can I view AWS S3 and Cloudflare R2 in the same window?",
      answer:
         "Both live in the same sidebar and you switch between them in a click, but you browse one server at a time rather than in two panes. S3 Viewer keeps a separate credential and signer per server. Moving objects between S3 and R2 is a job for rclone or the AWS CLI — see the how-to guide.",
   },
   {
      question: "Why use S3 Viewer alongside the Cloudflare dashboard?",
      answer:
         "Use the Cloudflare dashboard for what it's built for: buckets, tokens, custom domains, jurisdictional placement, billing. Use S3 Viewer for what it's built for: daily browsing — opening and previewing files, renaming, uploading big ones reliably, and sharing with teammates who don't have a Cloudflare account. They're complementary tools.",
   },
];

export default createUseCasePage({
   slug: SLUG,
   title: TITLE,
   keyword: KEYWORD,
   description: DESCRIPTION,
   seoTitle: "Cloudflare R2 Dashboard — Browse, Preview and Share R2 Buckets",
   seoDescription: META_DESCRIPTION,
   eyebrow: "Cloudflare R2",
   tagline: "Built for the people who actually open R2 buckets every day.",
   bullets: [
      "Prefix filtering and inline previews for R2 objects",
      "Share R2 buckets by email — no Cloudflare account required for the recipient",
      "Mix R2 servers with AWS S3, MinIO, and B2 in one sidebar",
   ],
   visual: <CloudflareR2Illustration />,
   features: [
      {
         icon: PencilLine,
         title: "Preview R2 files",
         body: "Open supported images, PDFs, text and other files directly in the browser. Rename R2 files from the file menu without downloading and re-uploading them.",
      },
      {
         icon: Search,
         title: "Filter an R2 folder",
         body: "The “Filter by prefix” box narrows the current folder's rows by prefix while you type — the same behavior as on an AWS bucket, since R2 answers the same ListObjectsV2 call.",
      },
      {
         icon: Eye,
         title: "Inline R2 previews",
         body: "Images, video, audio, PDF, Markdown, JSON and source code render in the browser via 15-minute presigned URLs.",
      },
      {
         icon: Upload,
         title: "Uploads with no bucket setup",
         body: "Files stream through S3 Viewer into R2 as a multipart upload — 25 MB parts, several at a time — so there is no CORS policy or exposed header to configure on the bucket, and a dropped connection is retried.",
      },
      {
         icon: UserPlus,
         title: "Share without Cloudflare access",
         body: "Invite teammates and clients by email. They sign in to S3 Viewer and see the R2 bucket — no Cloudflare account, no API token, no setup.",
      },
      {
         icon: Layers,
         title: "Mix R2 with S3",
         body: "An R2 server and an AWS server both live in the same sidebar, one click apart — though you browse one at a time, not side by side. For moving objects between them, reach for rclone — S3 Viewer is how you check both ends.",
      },
   ],
   steps,
   faqs,
   relatedHowTos: getRelatedHowTos([
      "rename-s3-file",
      "view-s3-and-r2-side-by-side",
      "upload-large-files-to-s3",
   ]),
   related: getRelated(SLUG),
});
