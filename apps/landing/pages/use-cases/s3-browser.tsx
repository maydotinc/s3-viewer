import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { getRelatedHowTos } from "@/components/HowTo/data";
import { getRelated } from "@/components/UseCases/data";
import { S3BrowserIllustration } from "@/components/UseCases/illustrations";
import { buildUseCaseJsonLd } from "@/components/UseCases/jsonld";
import UseCasePage, {
   type UseCaseFAQ,
   type UseCaseStep,
} from "@/components/UseCases/use-case-page";
import { SITE_URL } from "@/lib/site-config";
import {
   Command,
   Eye,
   Github,
   PencilLine,
   Search,
   Trash2,
} from "lucide-react";

const SLUG = "s3-browser";
const TITLE = "An S3 browser built for browsing.";
const KEYWORD = "S3 browser";
const DESCRIPTION =
   "S3 Viewer is a browser-based S3 client focused on the daily browsing-and-collaboration workflow: one-click rename, true bucket-wide search with Tab autocomplete, bulk delete, inline previews, and Cmd-K bucket switching across providers. Free, open-source, MIT-licensed.";

const steps: UseCaseStep[] = [
   {
      title: "Connect a bucket",
      body: "Paste an access key once. AWS S3 and Cloudflare R2 are auto-detected; for MinIO, B2, Wasabi, or any S3-compatible provider, drop in the endpoint URL.",
   },
   {
      title: "Browse, search, preview",
      body: "Type in the search bar — it paginates the entire bucket, not just the visible page. Hit Tab to autocomplete prefix paths. Click any file to preview images, video, audio, PDF, JSON, or source code inline.",
   },
   {
      title: "Right-click for the daily-use operations",
      body: "Rename in one click (the underlying S3 API has no rename — we wrap copy + delete with metadata preservation), copy or move across buckets, generate a presigned share link, or multi-select for bulk delete.",
   },
];

const faqs: UseCaseFAQ[] = [
   {
      question: "What is the best web-based S3 browser?",
      answer:
         "S3 Viewer is built for browsing — one-click rename (Amazon S3 has no rename API, so we wrap copy + delete with metadata preservation), true bucket-wide key search via paginated ListObjectsV2, bulk delete on multi-select, inline previews for 25+ file types, and Cmd-K bucket switching across every connected provider — AWS S3, Cloudflare R2, MinIO, Backblaze B2, Wasabi, and more.",
   },
   {
      question: "How does this compare to the AWS S3 console?",
      answer:
         "The AWS console is the right tool for configuring S3 — creating buckets, managing IAM, setting up replication, configuring lifecycle rules. It's not designed around daily file browsing. S3 Viewer focuses on that browsing layer: rename, paginated bucket-wide search, bulk operations, 25+ inline preview types, and every account's buckets behind one Cmd-K. Use both — the AWS console for setup, S3 Viewer for daily work.",
   },
   {
      question: "How is this different from Cyberduck, S3 Browser, or Mountain Duck?",
      answer:
         "Those are desktop apps — they store credentials on your machine, run on one OS at a time, and don't have a workspace model. S3 Viewer runs in any browser, encrypts credentials server-side with RSA-4096 (or you self-host them inside your VPC), and ships team workspaces — invite by email, assign per-bucket roles, revoke without rotating keys.",
   },
   {
      question: "Can I rename a file in S3?",
      answer:
         "Not natively — Amazon S3 has no rename API and keys are immutable once written. The standard pattern is to copy the object to the new key and delete the old one. S3 Viewer wraps that pattern in a single right-click and preserves metadata and tags by default. Above 5 GB it switches to multipart copy automatically.",
   },
   {
      question: "Can I search across all keys in a bucket, not just one prefix?",
      answer:
         "Yes. Type into the search bar and Tab to autocomplete the next prefix segment. S3 Viewer paginates ListObjectsV2 in the background and filters as results stream in. Finding `data/models/v2/training/checkpoint-42/weights.pt` becomes a few Tab presses, not 50 clicks through a deep folder tree.",
   },
   {
      question: "What file types can I preview without downloading?",
      answer:
         "Images (PNG, JPG, WebP, AVIF, SVG, GIF, BMP, TIFF, ICO), video (MP4, WebM, Ogg, MOV), audio (MP3, WAV, OGG, AAC, M4A, FLAC), PDF, plain text, Markdown, JSON, XML, HTML, CSS, JavaScript, Python, Java, and C source files.",
   },
   {
      question: "Does it work with MinIO, Backblaze B2, and self-hosted S3?",
      answer:
         "Yes. Point S3 Viewer at any S3-compatible endpoint, including private MinIO clusters inside your VPC. The same browser UI handles every provider that speaks the S3 API.",
   },
   {
      question: "Is S3 Viewer free?",
      answer:
         "Yes — it's free to use and MIT-licensed on GitHub. Self-host it or use the hosted build.",
   },
];

const Page = () => {
   const jsonLd = buildUseCaseJsonLd({
      slug: SLUG,
      title: `${TITLE} — S3 Viewer`,
      description: DESCRIPTION,
      siteUrl: SITE_URL,
      steps,
      faqs,
      keyword: KEYWORD,
   });

   return (
      <>
         <Seo
            title="S3 Browser — One-Click Rename, Bucket-Wide Search, Open Source"
            description={DESCRIPTION}
            canonical={`/use-cases/${SLUG}`}
            jsonLd={jsonLd}
         />
         <UseCasePage
            visual={<S3BrowserIllustration />}
            eyebrow="Better S3 browser"
            title={TITLE}
            subtitle={DESCRIPTION}
            description="A browsing layer on top of every S3-compatible provider."
            bullets={[
               "One-click rename — wrapping the S3 copy + delete pattern with metadata preserved",
               "Tab-autocomplete bucket-wide search across the full ListObjectsV2 result",
               "Cmd-K bucket switcher across every connected provider",
            ]}
            features={[
               {
                  icon: PencilLine,
                  title: "One-click rename",
                  body: "Amazon S3 has no rename API — keys are immutable. S3 Viewer wraps the standard copy + delete pattern in a single click, preserves metadata and tags by default, and only deletes the original after the new key writes successfully. Above 5 GB it switches to multipart copy.",
               },
               {
                  icon: Search,
                  title: "Tab-autocomplete search",
                  body: "Search paginates the entire bucket via ListObjectsV2 — not just the current 1,000-key page. Type the first few characters of a prefix and Tab autocompletes the next folder.",
               },
               {
                  icon: Eye,
                  title: "25+ inline previews",
                  body: "Images, video, audio, PDF, Markdown, JSON, and source code from JavaScript to Python render in the browser via short-lived presigned URLs.",
               },
               {
                  icon: Trash2,
                  title: "Multi-select bulk delete",
                  body: "Shift-click a range of keys and bulk-delete in a single DeleteObjects call — up to 1,000 keys per request, the way the S3 API was designed for.",
               },
               {
                  icon: Command,
                  title: "Cmd-K bucket switcher",
                  body: "Fuzzy-jump to any bucket on any connected provider in two keystrokes. No re-authenticating, no logging into a separate console.",
               },
               {
                  icon: Github,
                  title: "MIT, open source, self-hostable",
                  body: "Free to use, free to fork. Audit the code, run it inside your VPC, ship it to your enterprise — credentials never have to leave your network.",
               },
            ]}
            steps={steps}
            faqs={faqs}
            relatedHowTos={getRelatedHowTos([
               "rename-s3-file",
               "search-across-s3-buckets",
               "download-file-from-s3",
            ])}
            related={getRelated(SLUG)}
         />
      </>
   );
};

Page.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default Page;
