import { MultiCloudIllustration } from "@/components/UseCases/illustrations/use-cases/multi-cloud";
import {
   createUseCasePage,
   type UseCaseStep,
} from "@/components/UseCases/use-case-page";
import type { Faq } from "@/lib/types";
import { Cloud, Command, FolderTree, Layers, Search } from "lucide-react";
import { GitHubMark } from "@/components/social-marks";

const SLUG = "multi-cloud";
const TITLE = "Every cloud's bucket. One window.";
const META_DESCRIPTION =
   "One dashboard for AWS S3, Cloudflare R2, MinIO, Backblaze B2 and Wasabi — every provider you add in one sidebar, one file browser, one click to switch.";
const DESCRIPTION =
   "S3 Viewer is a unified dashboard for AWS S3, Cloudflare R2, MinIO, Backblaze B2, and Wasabi. Each provider has its own console; S3 Viewer is the layer on top — every provider you add sits in one sidebar, with the same file browser over all of them and one click to switch.";

const steps: UseCaseStep[] = [
   {
      title: "Add a provider",
      body: "Click Add server in the sidebar, paste an access key and secret, and enter the region and endpoint — AWS, Cloudflare R2, MinIO, B2, Wasabi, DigitalOcean Spaces and Tigris all connect the same way. S3 Viewer checks the credentials and lists the buckets they reach.",
   },
   {
      title: "See every server in one sidebar",
      body: "Each connection is its own entry in the sidebar with its buckets underneath, so you always know whether you're in AWS, R2, or MinIO. Add as many as you need — each keeps its own credentials, encrypted in your browser before they reach us.",
   },
   {
      title: "Switch, browse, filter",
      body: "Pick a server to browse its buckets, filter a folder, preview files, or download them. Upload, replace, rename, and delete all work the same way on every connected provider — AWS S3 and R2 enforce the safety checks directly, and Backblaze B2 and other S3-compatible endpoints get the same checks performed by S3 Viewer immediately before each write.",
   },
];

const faqs: Faq[] = [
   {
      question: "What is the best multi-cloud S3 dashboard?",
      answer:
         "S3 Viewer is built for the case where you have buckets on more than one provider — AWS S3, Cloudflare R2, MinIO, Backblaze B2, Wasabi, DigitalOcean Spaces, Tigris. Same sidebar, same file browser, one click to switch between them. The native AWS console and the Cloudflare R2 dashboard each focus on their own provider; S3 Viewer is the layer that connects them when you need to work across both.",
   },
   {
      question: "Can I view AWS S3 and Cloudflare R2 in the same dashboard?",
      answer:
         "Yes. S3 Viewer connects to AWS S3 and Cloudflare R2 through each provider's S3-compatible API. You add one server per provider and both appear in the same sidebar; switching between them is a click, with no re-authenticating. You browse one at a time rather than side by side.",
   },
   {
      question: "Which S3-compatible providers does S3 Viewer support?",
      answer:
         "Connect AWS S3, Cloudflare R2, Backblaze B2, MinIO, and other S3-compatible endpoints to browse, download, upload, replace, rename, and delete. AWS S3 and R2 enforce the safety conditions directly; B2 and other S3-compatible endpoints get the same checks performed by S3 Viewer immediately before each write, since their enforcement isn't independently verified. This is verified against MinIO in automated tests; AWS, R2 and B2 follow the same S3 semantics.",
   },
   {
      question:
         "How is this different from the AWS console or the Cloudflare R2 dashboard?",
      answer:
         "Each provider's native console handles accounts, permissions, billing, and bucket configuration. S3 Viewer brings browsing, previews, downloads, links, uploads, rename, deletion, and team invitations into one place, across every connected provider.",
   },
   {
      question: "Can I replace existing files on every provider?",
      answer:
         "Yes, on every provider. Replacements need confirmation and preserve the original readable metadata and storage settings; only an object encrypted with a customer-supplied key (SSE-C) refuses replacement, since S3 Viewer never has that key. AWS S3 and R2 enforce the ETag condition directly; other endpoints get the same check performed by S3 Viewer with a HEAD request immediately before the write.",
   },
   {
      question: "Can I copy or move files between S3 and R2?",
      answer:
         "Yes. S3 Viewer's Copy to… button duplicates a file within the same bucket using a server-side CopyObject. Copy to another bucket… sends a file, folder, or selection to any connected server; since S3's CopyObject needs the source and destination to share an endpoint, a copy between S3 and R2 streams through S3 Viewer's own server. For a large or repeated migration, use rclone sync or the AWS CLI — the how-to guide walks through both.",
   },
   {
      question: "Do my credentials get sent to your server?",
      answer:
         "They are encrypted in your browser with a public key before they are sent, so we only ever store the ciphertext. The API decrypts them in memory to sign an S3 request and nothing else — they never come back to the browser, never appear in a log, and never return in an API response. If that's still too much, S3 Viewer is MIT-licensed and self-hostable: run it inside your VPC and hold the private key yourself.",
   },
   {
      question:
         "Is there a limit on how many providers or buckets I can connect?",
      answer:
         "Each account can own up to 20 servers, with as many buckets under each as the credentials reach.",
   },
];

export default createUseCasePage({
   slug: SLUG,
   title: TITLE,
   description: DESCRIPTION,
   seoTitle: "Multi-Cloud S3 Dashboard — AWS S3, R2 and MinIO",
   seoDescription: META_DESCRIPTION,
   eyebrow: "Multi-cloud",
   headline: "One layer across every S3-compatible provider you use.",
   bullets: [
      "AWS S3, Cloudflare R2, MinIO, B2, Wasabi — same sidebar, same file browser",
      "One click to switch provider, with no re-authenticating",
      "Credentials encrypted in your browser before they reach us",
   ],
   visual: <MultiCloudIllustration />,
   features: [
      {
         icon: FolderTree,
         title: "One sidebar, every cloud",
         body: "Every server you have added, with its buckets underneath, in one tree. Each provider's native console is scoped to its own service; S3 Viewer is the layer that puts them together.",
      },
      {
         icon: Search,
         title: "Filter the folder you're in",
         body: "The “Filter by prefix” box above the file list narrows the current folder's rows by prefix as you type — the same behavior on every provider, since they all answer the same ListObjectsV2 call.",
      },
      {
         icon: Layers,
         title: "The same features everywhere",
         body: "Browse, download, upload, replace, rename, and delete across every connected provider. AWS S3 and R2 enforce the safety checks directly; B2 and other endpoints get the same checks from S3 Viewer immediately before each write.",
      },
      {
         icon: Command,
         title: "Switch in one click",
         body: "Pick another server in the sidebar and you are in the other cloud. No re-authenticating, no logging into a separate console.",
      },
      {
         icon: Cloud,
         title: "Restricted-token friendly",
         body: "Have a token without ListBuckets permission? Name the buckets it may reach when you add the server — S3 Viewer skips the listing call and works from your list.",
      },
      {
         icon: GitHubMark,
         title: "MIT-licensed, self-hostable",
         body: "Free to use, free to fork. Self-host the same multi-cloud UI inside your VPC and credentials never leave your network.",
      },
   ],
   steps,
   faqs,
   relatedHowTos: [
      "view-s3-and-r2-side-by-side",
      "switch-between-s3-buckets",
      "search-across-s3-buckets",
   ],
});
