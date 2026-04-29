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
   Eye,
   Github,
   Globe,
   PencilLine,
   Search,
   Zap,
} from "lucide-react";

const SLUG = "s3-browser";
const TITLE = "A browser-based S3 client built for developers.";
const KEYWORD = "S3 browser";
const DESCRIPTION =
   "S3 Viewer is a free, open-source S3 browser that runs in any browser. Real bucket-wide key search, inline previews for images, video, PDF, JSON, and code, and Cmd-K bucket switching. Works with AWS S3, Cloudflare R2, MinIO, Backblaze B2, and Wasabi.";

const steps: UseCaseStep[] = [
   {
      title: "Connect a bucket",
      body: "Paste an access key once. AWS S3 and Cloudflare R2 are auto-detected; for MinIO, B2, Wasabi, or any S3-compatible provider, drop in the endpoint URL.",
   },
   {
      title: "Browse or search",
      body: "Use the tree to navigate prefixes, or type in the search bar to match keys across the entire bucket — not just the visible page.",
   },
   {
      title: "Preview, download, or rename",
      body: "Click a file to preview it inline. Download with one click. Right-click to rename, copy, move, or delete — including bulk delete across many keys.",
   },
];

const faqs: UseCaseFAQ[] = [
   {
      question: "What is the best web-based S3 browser?",
      answer:
         "S3 Viewer is a browser-based S3 client built for developers. It adds bucket-wide key search, inline previews for images, video, audio, PDF, JSON, and source code, multipart upload with retries, rename via copy+delete, and Cmd-K bucket switching to AWS S3 — and works with Cloudflare R2, MinIO, Backblaze B2, Wasabi, DigitalOcean Spaces, and any other S3-compatible provider.",
   },
   {
      question: "Why is this better than the AWS S3 console?",
      answer:
         "The AWS console is a configuration UI, not a file browser. Its search only filters the current 1,000-key page, it has no rename, no inline preview for most file types, and switching between accounts and buckets requires re-entering credentials. S3 Viewer paginates through ListObjectsV2 for true bucket-wide search, previews 30+ file types inline, supports rename, and lets you keep every bucket from every account loaded behind Cmd-K.",
   },
   {
      question: "How is this different from Cyberduck, S3 Browser, or Mountain Duck?",
      answer:
         "Those are desktop apps that store credentials on your machine and only run on one OS. S3 Viewer is a web app — it works in any browser, on any OS, and credentials stay encrypted on the server (or self-hosted on yours). It also has team workspaces, per-bucket roles, and email-based sharing built in.",
   },
   {
      question: "Can I search across all keys in a bucket, not just one prefix?",
      answer:
         "Yes. S3 Viewer paginates through ListObjectsV2 in the background and filters in-memory as you type, so you can find a key anywhere in the bucket from any path. Results show the full key so you can see exactly where each match lives.",
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
         "It's free to use and MIT-licensed on GitHub. You can run it hosted or self-host it yourself.",
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
            title="S3 Browser — Open-Source Web Client for AWS S3 and R2"
            description={DESCRIPTION}
            canonical={`/use-cases/${SLUG}`}
            jsonLd={jsonLd}
         />
         <UseCasePage
            visual={<S3BrowserIllustration />}
            eyebrow="Better S3 browser"
            title={TITLE}
            subtitle={DESCRIPTION}
            description="The S3 browser the AWS console refuses to be."
            bullets={[
               "Search keys across an entire bucket — not just the current 1,000-key page",
               "Inline preview for images, video, audio, PDF, JSON, and source code",
               "Cmd-K bucket switcher across every connected provider",
            ]}
            features={[
               {
                  icon: Search,
                  title: "Real bucket-wide search",
                  body: "Type any part of a key. S3 Viewer paginates ListObjectsV2 in the background and filters as results stream in. The AWS console only filters the visible page.",
               },
               {
                  icon: Eye,
                  title: "Inline previews",
                  body: "30+ file types render in the browser: images, video, audio, PDF, JSON, Markdown, and source code from JavaScript to Python.",
               },
               {
                  icon: PencilLine,
                  title: "Rename and bulk delete",
                  body: "Right-click to rename via copy + delete, or multi-select to bulk delete across many keys at once. The console makes you click each one.",
               },
               {
                  icon: Zap,
                  title: "Cmd-K bucket switcher",
                  body: "Fuzzy-jump to any bucket on any connected provider. No re-entering credentials, no logging into another console.",
               },
               {
                  icon: Globe,
                  title: "Runs in any browser",
                  body: "No CLI to install, no desktop app to update. Open a tab and you're browsing — on macOS, Linux, Windows, or a Chromebook.",
               },
               {
                  icon: Github,
                  title: "Open source, MIT-licensed",
                  body: "Free to use, free to self-host. Audit the code, fork it, run it inside your VPC. Credentials never have to leave your network.",
               },
            ]}
            steps={steps}
            faqs={faqs}
            relatedHowTos={getRelatedHowTos([
               "search-across-s3-buckets",
               "download-file-from-s3",
               "rename-s3-file",
            ])}
            related={getRelated(SLUG)}
         />
      </>
   );
};

Page.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default Page;
