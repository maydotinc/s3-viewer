import { getRelatedHowTos } from "@/components/HowTo/data";
import { getRelated } from "@/components/UseCases/data";
import { S3BrowserIllustration } from "@/components/UseCases/illustrations";
import {
   createUseCasePage,
   type UseCaseFAQ,
   type UseCaseStep,
} from "@/components/UseCases/use-case-page";
import { Command, Eye, Github, PencilLine, Search, Trash2 } from "lucide-react";

const SLUG = "s3-browser";
const TITLE = "An S3 browser built for browsing.";
const KEYWORD = "S3 browser";
const META_DESCRIPTION =
   "Browse, filter, preview, and download across S3-compatible providers, with guarded rename and multi-select deletion on AWS S3.";
const DESCRIPTION =
   "S3 Viewer brings connected providers into one browser for filtering, previews, downloads, and team sharing. AWS S3 also supports guarded rename and multi-select deletion. Upload availability depends on the provider. Free, open-source, MIT-licensed.";

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
      body: "Download a file or copy a temporary link. On AWS S3, you can also rename a reviewed object, delete a selection, or delete a folder's contents. Those actions reject files that changed since review; object rename and deletion are blocked on R2, B2, and other endpoints.",
   },
];

const faqs: UseCaseFAQ[] = [
   {
      question: "What is the best web-based S3 browser?",
      answer:
         "S3 Viewer provides a folder prefix filter, inline previews, downloads, and team sharing across connected S3-compatible providers. AWS S3 also supports guarded rename and multi-select deletion. R2 and AWS S3 uploads protect existing files; B2 uploads are currently blocked, and other endpoints need compatible overwrite protection.",
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
         "On AWS S3, use ⋮ → Rename for an object up to 5 GB. S3 Viewer checks the file you reviewed, preserves readable permissions and settings, and refuses an occupied destination. Unreadable encryption settings block the action. Rename is currently unavailable on R2, B2, MinIO, and other endpoints.",
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
         "You can connect compatible endpoints to browse, preview, download, and share files. B2 uploads and object rename/deletion outside AWS S3 are blocked. Other uploads require verified overwrite protection; replacement also needs readable original settings, which some MinIO setups cannot provide. Private endpoints require a trusted self-hosted installation configured to allow them.",
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
   keyword: KEYWORD,
   description: DESCRIPTION,
   seoTitle: "S3 Browser — Rename, Previews, Multi-Select Delete, Open Source",
   seoDescription: META_DESCRIPTION,
   eyebrow: "Better S3 browser",
   tagline: "A browsing layer on top of every S3-compatible provider.",
   bullets: [
      "Guarded rename and multi-select deletion on AWS S3",
      "Inline previews for images, video, audio, PDF and text formats",
      "Every connected provider in one sidebar, one click apart",
   ],
   visual: <S3BrowserIllustration />,
   features: [
      {
         icon: PencilLine,
         title: "Guarded AWS S3 rename",
         body: "Rename an AWS S3 object up to 5 GB after reviewing it. The app checks for changes, preserves readable settings, and refuses an occupied destination. Unsupported encryption or unreadable permissions stop the action before copying.",
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
         title: "AWS S3 multi-select delete",
         body: "Select reviewed AWS S3 objects and confirm Delete, or delete a folder's contents. Changed files and uncertain results require fresh review. R2 and other providers do not execute object deletion.",
      },
      {
         icon: Command,
         title: "One sidebar, every provider",
         body: "Every server you've added, with its buckets underneath. Switching from an AWS bucket to an R2 bucket is a click — no re-authenticating, no separate console.",
      },
      {
         icon: Github,
         title: "MIT, open source, self-hostable",
         body: "Free to use, free to fork. Audit the code, run it inside your VPC, ship it to your enterprise — credentials never have to leave your network.",
      },
   ],
   steps,
   faqs,
   relatedHowTos: getRelatedHowTos([
      "rename-s3-file",
      "search-across-s3-buckets",
      "download-file-from-s3",
   ]),
   related: getRelated(SLUG),
});
