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
import { Command, Eye, Github, PencilLine, Search, Trash2 } from "lucide-react";

const SLUG = "s3-browser";
const TITLE = "An S3 browser built for browsing.";
const KEYWORD = "S3 browser";
const META_DESCRIPTION =
   "A browser-based S3 client for daily work: one-step rename, a prefix filter, multi-select delete, inline previews, and every provider in one sidebar.";
const DESCRIPTION =
   "S3 Viewer is a browser-based S3 client focused on the daily browsing-and-collaboration workflow: one-step rename, a prefix filter on the folder you're in, multi-select delete, inline previews, and every connected provider in one sidebar. Free, open-source, MIT-licensed.";

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
      body: "Download, Copy link (a 15-minute presigned URL), Rename (the S3 API has no rename — we wrap copy + delete, and refuse to overwrite an existing key) and Delete. Tick checkboxes to delete several at once, or use Delete folder on a folder row to clear a whole prefix.",
   },
];

const faqs: UseCaseFAQ[] = [
   {
      question: "What is the best web-based S3 browser?",
      answer:
         "S3 Viewer is built for browsing — one-step rename (Amazon S3 has no rename API, so we wrap copy + delete), a prefix filter on the folder you're in, checkbox multi-select delete, inline previews for images, video, audio, PDF and text formats, and every connected provider in one sidebar: AWS S3, Cloudflare R2, MinIO, Backblaze B2, Wasabi, and more.",
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
         "Not natively — Amazon S3 has no rename API and keys are immutable once written. The standard pattern is to copy the object to the new key and delete the old one. S3 Viewer wraps that pattern behind ⋮ → Rename: metadata carries over, the source is only deleted once the copy succeeds, and it refuses to overwrite an existing key. Objects above 5 GB need a multipart copy, so use the CLI for those.",
   },
   {
      question:
         "Can I search across all keys in a bucket, not just one prefix?",
      answer:
         "Not yet — search is a prefix filter on the folder you're currently in, and it doesn't recurse or span buckets. For a recursive sweep use `aws s3 ls s3://bucket --recursive | grep <query>`, or S3 Inventory + Athena on very large buckets.",
   },
   {
      question: "What file types can I preview without downloading?",
      answer:
         "The preview is picked from the content type your bucket reports for the object, so anything image/*, video/*, audio/*, application/pdf or text/* renders inline, plus JSON, XML, YAML and SQL. That covers PNG, JPEG, GIF, WebP and SVG; MP4, WebM and Ogg; MP3, WAV and FLAC; PDF; and Markdown, CSV, HTML, CSS and source code. Objects stored as application/octet-stream have no content type to go on, so they download instead. Previews are capped at 50 MB.",
   },
   {
      question: "Does it work with MinIO, Backblaze B2, and self-hosted S3?",
      answer:
         "Yes. Point a server at any S3-compatible endpoint, including private MinIO clusters inside your VPC. The same browser UI handles every provider that speaks the S3 API.",
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
            title="S3 Browser — Rename, Previews, Multi-Select Delete, Open Source"
            description={META_DESCRIPTION}
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
               "One-step rename — wrapping the S3 copy + delete pattern, metadata preserved",
               "Inline previews for images, video, audio, PDF and text formats",
               "Every connected provider in one sidebar, one click apart",
            ]}
            features={[
               {
                  icon: PencilLine,
                  title: "One-step rename",
                  body: "Amazon S3 has no rename API — keys are immutable. S3 Viewer wraps the standard copy + delete pattern behind ⋮ → Rename: metadata carries over, the original is deleted only after the new key writes, and an existing key is never silently overwritten. Objects over 5 GB need a multipart copy from the CLI.",
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
                  title: "Multi-select delete",
                  body: "Tick the checkboxes and hit Delete — the selection goes out as a single DeleteObjects call, up to 1,000 keys per request. Delete folder on a folder row clears the whole prefix recursively.",
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
