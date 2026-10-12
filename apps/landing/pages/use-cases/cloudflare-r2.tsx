import { CloudflareR2Illustration } from "@/components/UseCases/illustrations/use-cases/cloudflare-r2";
import {
   createUseCasePage,
   type UseCaseStep,
} from "@/components/UseCases/use-case-page";
import type { Faq } from "@/lib/types";
import { Eye, Layers, Download, Search, Upload, UserPlus } from "lucide-react";

const SLUG = "cloudflare-r2";
const TITLE = "A daily-use dashboard for Cloudflare R2.";
const META_DESCRIPTION =
   "A daily-use dashboard for Cloudflare R2: inline previews, streamed uploads with no bucket setup, email invites, and your AWS buckets in the same sidebar.";
const DESCRIPTION =
   "S3 Viewer connects to Cloudflare R2 through its S3-compatible API for daily file browsing: inline previews, streamed uploads that need no CORS policy on the bucket, email invites, and R2 in the same sidebar as your AWS buckets.";

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
      title: "Browse, upload, and share R2 files",
      body: "Filter a folder by prefix. Upload multi-GB files — they stream through S3 Viewer into R2 as a multipart upload, with no CORS policy to set on the bucket. Invite teammates by email — they don't need a Cloudflare account.",
   },
];

const faqs: Faq[] = [
   {
      question: "Is there a better dashboard for Cloudflare R2?",
      answer:
         "S3 Viewer is built for the daily browsing layer on top of R2. The Cloudflare dashboard is the right place to create buckets, manage R2 API tokens, configure custom domains, and handle billing. S3 Viewer adds inline file previews, a prefix filter inside each folder, uploads that stream through S3 Viewer with no bucket configuration, team sharing by email, and your AWS buckets one click away in the same sidebar.",
   },
   {
      question: "How do I rename a file in Cloudflare R2?",
      answer:
         "Open the ⋮ menu on the object and choose Rename. S3 Viewer copies the object to the new key server-side, then deletes the original — the same server-side pattern it uses on AWS S3. Because R2's plain DELETE has no delete-time condition, S3 Viewer checks the object is still the one you reviewed with a HEAD request immediately beforehand, rather than relying on R2 to enforce it.",
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
         "Yes. Click Share and invite them by email. Viewers can browse and download; Editors can also upload, rename, and create buckets where the storage token allows it; Admins can manage members and server settings. Recipients need no Cloudflare account or API token.",
   },
   {
      question: "Are large uploads to R2 reliable?",
      answer:
         "Large files stream through S3 Viewer in parts, without a bucket CORS policy. New uploads can retry network failures while protecting existing files. Replacements require confirmation, preserve readable object settings, and stop if the reviewed file changes. An uncertain replacement needs fresh review; failed uploads attempt to clean up unfinished parts.",
   },
   {
      question: "Can I view AWS S3 and Cloudflare R2 in the same window?",
      answer:
         "Both live in the same sidebar and you switch between them in a click, but you browse one server at a time rather than in two panes. S3 Viewer keeps a separate credential and signer per server. Copy to another bucket… streams objects between S3 and R2; for a bulk migration, use rclone or the AWS CLI — see the how-to guide.",
   },
   {
      question: "Why use S3 Viewer alongside the Cloudflare dashboard?",
      answer:
         "Use the Cloudflare dashboard for buckets, tokens, custom domains, placement, and billing. Use S3 Viewer to browse, preview, download, upload, rename, and share files with teammates who don't have a Cloudflare account.",
   },
];

export default createUseCasePage({
   slug: SLUG,
   title: TITLE,
   description: DESCRIPTION,
   seoTitle: "Cloudflare R2 Dashboard — Browse, Preview, Share",
   seoDescription: META_DESCRIPTION,
   eyebrow: "Cloudflare R2",
   headline: "Built for the people who actually open R2 buckets every day.",
   bullets: [
      "Prefix filtering and inline previews for R2 objects",
      "Share R2 buckets by email — no Cloudflare account required for the recipient",
      "Mix R2 servers with AWS S3, MinIO, and B2 in one sidebar",
   ],
   visual: <CloudflareR2Illustration />,
   features: [
      {
         icon: Download,
         title: "Download R2 files",
         body: "Download original files or copy a temporary download link. Rename, Copy to…, and deletion all work on R2 — each checks the object is still the one you reviewed before touching it, so a concurrent writer's change is caught rather than silently overwritten.",
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
         body: "Files stream through S3 Viewer into R2 with no bucket CORS setup. Existing files need confirmation before replacement; unreadable settings or a changed file stop the upload.",
      },
      {
         icon: UserPlus,
         title: "Share without Cloudflare access",
         body: "Invite teammates and clients by email. They sign in to S3 Viewer and see the R2 bucket — no Cloudflare account, no API token, no setup.",
      },
      {
         icon: Layers,
         title: "Mix R2 with S3",
         body: "An R2 server and an AWS server both live in the same sidebar, one click apart — though you browse one at a time, not side by side. Copy to another bucket… streams objects between them; for a bulk migration, reach for rclone.",
      },
   ],
   steps,
   faqs,
   relatedHowTos: [
      "rename-s3-file",
      "view-s3-and-r2-side-by-side",
      "upload-large-files-to-s3",
   ],
});
