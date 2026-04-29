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
   Download,
   Eye,
   Keyboard,
   MousePointerClick,
   Search,
   Zap,
} from "lucide-react";

const SLUG = "s3-browser";
const TITLE = "A faster way to browse S3.";
const KEYWORD = "S3 browser";
const DESCRIPTION =
   "S3 Viewer is a web-based S3 browser with real search, instant previews, and clean downloads. Works with AWS S3, R2, B2, MinIO, and Wasabi.";

const steps: UseCaseStep[] = [
   {
      title: "Connect a bucket",
      body: "Paste your access key once. We auto-detect the endpoint and start listing objects.",
   },
   {
      title: "Browse or search",
      body: "Use the tree, or hit / to search keys across the entire bucket — not just the current page.",
   },
   {
      title: "Preview or download",
      body: "Click a file to preview it inline. Click download or drag straight to your desktop.",
   },
];

const faqs: UseCaseFAQ[] = [
   {
      question: "What's the best web-based S3 browser?",
      answer:
         "S3 Viewer is built for browsing — fast key search, inline previews for common formats (images, video, PDF, JSON, CSV), multi-select, and keyboard navigation. It works with AWS S3, Cloudflare R2, MinIO, Backblaze B2, and Wasabi.",
   },
   {
      question:
         "Can I search across all keys in a bucket, not just one prefix?",
      answer:
         "Yes. Search runs against the whole bucket from any path. Results show the full key so you can see where each match lives.",
   },
   {
      question: "What file types can I preview without downloading?",
      answer:
         "Images (PNG, JPG, WebP, AVIF, SVG, GIF), video (MP4, WebM), audio, PDF, JSON, CSV, Markdown, and plain text or log files.",
   },
   {
      question: "Can I download an entire folder at once?",
      answer:
         "Yes. Select a prefix and download as a zip, or multi-select files and download them together.",
   },
   {
      question: "Does it work with MinIO and self-hosted S3?",
      answer:
         "Yes. Point it at any S3-compatible endpoint, including private MinIO clusters inside your VPC.",
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
            title="S3 Browser — Search, View, and Download Files"
            description={DESCRIPTION}
            canonical={`/use-cases/${SLUG}`}
            jsonLd={jsonLd}
         />
         <UseCasePage
            visual={<S3BrowserIllustration />}
            eyebrow="Better S3 browser"
            title={TITLE}
            subtitle={DESCRIPTION}
            description="The web S3 browser you wish came with the cloud."
            bullets={[
               "Search keys across an entire bucket, not just the current folder",
               "Preview images, video, JSON, CSV, PDF, and logs in-browser",
               "Download single files, multi-select, or full prefixes as zip",
            ]}
            features={[
               {
                  icon: Search,
                  title: "Real search",
                  body: "Type in the search bar and match keys across the bucket, not just the current page.",
               },
               {
                  icon: Eye,
                  title: "Previews",
                  body: "Images, video, audio, PDFs, JSON, CSV, and plain text render inline.",
               },
               {
                  icon: MousePointerClick,
                  title: "Multi-select",
                  body: "Shift-click and bulk download, delete, or rename.",
               },
               {
                  icon: Keyboard,
                  title: "Keyboard navigation",
                  body: "Arrow keys, / to search, Enter to open. Built for power users.",
               },
               {
                  icon: Zap,
                  title: "Fast bucket switching",
                  body: "Cmd-K jumps between any connected bucket across providers.",
               },
               {
                  icon: Download,
                  title: "No CLI required",
                  body: "Everything works in the browser. Install nothing, configure nothing.",
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
