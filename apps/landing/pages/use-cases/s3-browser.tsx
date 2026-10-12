import { S3BrowserIllustration } from "@/components/UseCases/illustrations/use-cases/s3-browser";
import {
   createUseCasePage,
   type UseCaseStep,
} from "@/components/UseCases/use-case-page";
import type { Faq } from "@/lib/types";
import { GitHubMark } from "@/components/social-marks";
import { Command, Eye, PencilLine, Search, Trash2 } from "lucide-react";

const SLUG = "s3-browser";
const TITLE = "An S3 browser built for browsing.";
const META_DESCRIPTION =
   "Browse, filter, preview, and download across S3-compatible providers, with guarded rename and multi-select deletion on every one of them.";
const DESCRIPTION =
   "S3 Viewer brings connected providers into one browser for filtering, previews, downloads, and team sharing. Guarded rename, replace, and multi-select deletion all work the same way on AWS S3, Cloudflare R2, Backblaze B2, and other S3-compatible endpoints. Free, open-source, MIT-licensed.";

const steps: UseCaseStep[] = [
   {
      title: "Add a server",
      body: "Click Add server, paste an access key and secret, and enter the region and endpoint. AWS S3, Cloudflare R2, MinIO, B2, Wasabi — anything that speaks the S3 API connects the same way.",
   },
   {
      title: "Browse, filter, preview",
      body: "Folders and objects list together, folders first. The “Filter by prefix” box filters the current folder's rows by prefix as you type. Click any file to preview images, video, audio, PDF, JSON, Markdown or source code inline.",
   },
   {
      title: "Open the ⋮ menu for the daily-use operations",
      body: "Download a file or copy a temporary link. You can also rename a reviewed object, copy it, delete a selection, or delete a folder's contents — on any connected provider. Those actions reject files that changed since review, whether the provider enforces that check itself (AWS S3) or S3 Viewer confirms it with a HEAD request first (R2, B2, and other endpoints).",
   },
];

const faqs: Faq[] = [
   {
      question: "What is the best web-based S3 browser?",
      answer:
         "S3 Viewer provides a folder prefix filter, inline previews, downloads, and team sharing across connected S3-compatible providers. Guarded rename, replace, and multi-select deletion all work on AWS S3, R2, B2, and other endpoints — AWS S3 and R2 enforce the safety conditions directly, and B2/other endpoints get the same checks from S3 Viewer immediately before each write.",
   },
   {
      question: "How does this compare to the AWS S3 console?",
      answer:
         "The AWS console is the right tool for configuring S3 — creating buckets, managing IAM, setting up replication, configuring lifecycle rules. It's not designed around daily file browsing. S3 Viewer focuses on that browsing layer: rename, inline previews, multi-select delete, share links, and every account's buckets in one sidebar. Use both — the AWS console for setup, S3 Viewer for daily work.",
   },
   {
      question:
         "How is this different from Cyberduck, S3 Browser, or Mountain Duck?",
      answer:
         "Those are desktop apps — they store credentials on your machine, run on one OS at a time, and have no shared-team model. S3 Viewer runs in any browser, encrypts credentials in your browser before they reach the server (or you self-host the whole thing inside your VPC), and ships team access — invite by email, give each member a role, remove them without rotating keys.",
   },
   {
      question: "Can I rename a file in S3?",
      answer:
         "Yes, on any connected provider: use ⋮ → Rename. S3 Viewer checks the file you reviewed, preserves readable permissions and settings, and refuses an occupied destination. Files above 5 GB copy in multipart parts automatically, except on Cloudflare R2, where rename stops at 5 GiB per object. An SSE-C encrypted object also refuses the action, since S3 Viewer never has the customer-supplied key.",
   },
   {
      question:
         "Can I search across all keys in a bucket, not just one prefix?",
      answer:
         "Not yet — search is a prefix filter on the folder you're currently in, and it doesn't recurse or span buckets. For a recursive sweep use aws s3 ls s3://bucket --recursive | grep <query>, or S3 Inventory + Athena on very large buckets.",
   },
   {
      question: "What file types can I preview without downloading?",
      answer:
         "The preview is picked from the content type your bucket reports for the object, so anything image/*, video/*, audio/*, application/pdf or text/* renders inline, plus JSON, XML, YAML and SQL. That covers PNG, JPEG, GIF, WebP and SVG; MP4, WebM and Ogg; MP3, WAV and FLAC; PDF; and Markdown, CSV, HTML, CSS and source code. Objects stored as application/octet-stream have no content type to go on, so they download instead. Previews are capped at 50 MB.",
   },
   {
      question: "Does it work with MinIO, Backblaze B2, and self-hosted S3?",
      answer:
         "Yes. Connect any of them to browse, preview, download, upload, rename, and share files, the same as AWS S3. B2 and MinIO's conditional-write enforcement isn't independently verified, so S3 Viewer checks with a HEAD request immediately before each write instead of trusting the endpoint; replacement also needs readable original settings, which some MinIO setups cannot provide, in which case it's refused rather than guessed at. Private endpoints require a trusted self-hosted installation configured to allow them.",
   },
   {
      question: "Is S3 Viewer free?",
      answer:
         "Yes — it's free to use and MIT-licensed on GitHub. Self-host it or use the hosted build.",
   },
];

export default createUseCasePage({
   slug: SLUG,
   title: TITLE,
   description: DESCRIPTION,
   seoTitle: "Open-Source S3 Browser — Rename, Preview, Delete",
   seoDescription: META_DESCRIPTION,
   eyebrow: "Better S3 browser",
   headline: "A browsing layer on top of every S3-compatible provider.",
   bullets: [
      "Guarded rename and multi-select deletion on every connected provider",
      "Inline previews for images, video, audio, PDF and text formats",
      "Every connected provider in one sidebar, one click apart",
   ],
   visual: <S3BrowserIllustration />,
   features: [
      {
         icon: PencilLine,
         title: "Guarded rename on every provider",
         body: "Rename an object after reviewing it — files above 5 GB copy in multipart parts automatically (R2 stops at 5 GiB per object). The app checks for changes, preserves readable settings, and refuses an occupied destination, on AWS S3, R2, B2, and other endpoints alike. An SSE-C encrypted object stops the action before copying.",
      },
      {
         icon: Search,
         title: "Prefix filter as you type",
         body: "The “Filter by prefix” box narrows the current folder's rows by prefix while you type — folders and objects both. It's scoped to the folder you're in, which keeps it instant and predictable.",
      },
      {
         icon: Eye,
         title: "Inline previews",
         body: "Images, video, audio, PDF, Markdown, JSON and source code from JavaScript to Python render in the browser via 15-minute presigned URLs.",
      },
      {
         icon: Trash2,
         title: "Multi-select delete on every provider",
         body: "Select reviewed objects and confirm Delete, or delete a folder's contents, on AWS S3, R2, B2, or any other connected endpoint. Changed files and uncertain results require fresh review.",
      },
      {
         icon: Command,
         title: "One sidebar, every provider",
         body: "Every server you've added, with its buckets underneath. Switching from an AWS bucket to an R2 bucket is a click — no re-authenticating, no separate console.",
      },
      {
         icon: GitHubMark,
         title: "MIT, open source, self-hostable",
         body: "Free to use, free to fork. Audit the code, run it inside your VPC, ship it to your enterprise — credentials never have to leave your network.",
      },
   ],
   steps,
   faqs,
   relatedHowTos: [
      "rename-s3-file",
      "search-across-s3-buckets",
      "download-file-from-s3",
   ],
});
