import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { getRelatedHowTos } from "@/components/HowTo/data";
import { getRelated } from "@/components/UseCases/data";
import { MultiCloudIllustration } from "@/components/UseCases/illustrations";
import { buildUseCaseJsonLd } from "@/components/UseCases/jsonld";
import UseCasePage, {
   type UseCaseFAQ,
   type UseCaseStep,
} from "@/components/UseCases/use-case-page";
import { SITE_URL } from "@/lib/site-config";
import {
   Cloud,
   Command,
   FolderTree,
   Github,
   Layers,
   Search,
} from "lucide-react";

const SLUG = "multi-cloud";
const TITLE = "Every cloud's bucket. One window.";
const KEYWORD = "multi-cloud S3 dashboard";
const DESCRIPTION =
   "S3 Viewer is a unified dashboard for AWS S3, Cloudflare R2, MinIO, Backblaze B2, and Wasabi. Each provider has its own console; S3 Viewer is the layer on top — one sidebar, one search box, one Cmd-K to jump anywhere, with cross-cloud copy and move when you need it.";

const steps: UseCaseStep[] = [
   {
      title: "Add a provider",
      body: "Paste an access key. AWS S3 and Cloudflare R2 are auto-detected from the endpoint; for MinIO, B2, Wasabi, DigitalOcean Spaces, or Tigris, drop in the endpoint URL once and we wire up the rest.",
   },
   {
      title: "See every bucket in one sidebar",
      body: "Buckets show up grouped and color-coded by provider, so you always know whether you're in AWS, R2, or MinIO. Add as many providers as you need — each keeps its own credentials, encrypted at rest with RSA-4096.",
   },
   {
      title: "Cmd-K, search, copy across clouds",
      body: "Cmd-K fuzzy-jumps to any bucket on any provider. Search runs across every open bucket. Right-click an object to copy or move it across providers — S3 to R2, B2 to MinIO — streamed server-side, no local download.",
   },
];

const faqs: UseCaseFAQ[] = [
   {
      question: "What is the best multi-cloud S3 dashboard?",
      answer:
         "S3 Viewer is built for the case where you have buckets on more than one provider — AWS S3, Cloudflare R2, MinIO, Backblaze B2, Wasabi, DigitalOcean Spaces, Tigris. Same sidebar, same search, same Cmd-K switcher across all of them. The native AWS console and the Cloudflare R2 dashboard each focus on their own provider; S3 Viewer is the layer that connects them when you need to work across both.",
   },
   {
      question: "Can I view AWS S3 and Cloudflare R2 in the same dashboard?",
      answer:
         "Yes — and you can copy or move objects between them. S3 Viewer connects to AWS S3 and Cloudflare R2 simultaneously through each provider's S3-compatible API. You add one credential per provider and both appear in the same sidebar; right-click any file to copy it across.",
   },
   {
      question: "Which S3-compatible providers does S3 Viewer support?",
      answer:
         "Anything that implements the S3 API: AWS S3, Cloudflare R2, Backblaze B2, MinIO, Wasabi, DigitalOcean Spaces, Tigris, SeaweedFS, Ceph RGW, and self-hosted S3 gateways. AWS and R2 are auto-detected from the endpoint; the rest take an endpoint URL and we set up the signer.",
   },
   {
      question: "How is this different from the AWS console or the Cloudflare R2 dashboard?",
      answer:
         "Each provider's native console is the right tool for managing accounts, IAM, billing, and bucket configuration on that provider. S3 Viewer focuses on the day-to-day browsing-and-collaboration layer that sits on top of every provider — search across buckets, rename, multipart upload with retries, share by email, copy across clouds. Use both: their console for setup, S3 Viewer for daily work.",
   },
   {
      question: "Can I copy or move files between S3 and R2?",
      answer:
         "Yes. Right-click any object and choose Copy or Move. S3 Viewer streams the bytes server-side from the source bucket and writes them to the destination using each provider's S3 API — no local download, no re-upload, no leaving the browser. Works in any direction: S3 → R2, R2 → MinIO, B2 → S3.",
   },
   {
      question: "Do my credentials get sent to your server?",
      answer:
         "Credentials are encrypted at rest with RSA-4096 (PKCS1_OAEP, SHA-256) and only decrypted in memory to sign each S3 request. They never reach the browser, never appear in any log, and never return in any API response. If that's still too much, S3 Viewer is MIT-licensed and self-hostable — run the same UI inside your VPC and the keys never leave your network.",
   },
   {
      question: "Is there a limit on how many providers or buckets I can connect?",
      answer:
         "No. Connect as many providers and as many buckets as you need. The self-hosted build has no limits at all.",
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
            title="Multi-Cloud S3 Dashboard — AWS S3 + Cloudflare R2 + MinIO in One Window"
            description={DESCRIPTION}
            canonical={`/use-cases/${SLUG}`}
            jsonLd={jsonLd}
         />
         <UseCasePage
            visual={<MultiCloudIllustration />}
            eyebrow="Multi-cloud"
            title={TITLE}
            subtitle={DESCRIPTION}
            description="One layer across every S3-compatible provider you use."
            bullets={[
               "AWS S3, Cloudflare R2, MinIO, B2, Wasabi — same sidebar, same search",
               "Cross-cloud copy and move, streamed server-side",
               "Cmd-K to jump to any bucket on any provider",
            ]}
            features={[
               {
                  icon: FolderTree,
                  title: "One sidebar, every cloud",
                  body: "Every bucket from every connected provider in one tree, grouped and color-coded. Each provider's native console is scoped to its own service; S3 Viewer is the layer that puts them together.",
               },
               {
                  icon: Search,
                  title: "Cross-bucket search with Tab autocomplete",
                  body: "Type the first few characters and Tab autocompletes the next prefix. Search paginates ListObjectsV2 across every open bucket — even on different clouds.",
               },
               {
                  icon: Layers,
                  title: "Cross-cloud copy and move",
                  body: "Right-click an object to copy or move it from S3 to R2, R2 to MinIO, anywhere. Streamed server-side; metadata and tags preserved by default.",
               },
               {
                  icon: Command,
                  title: "Cmd-K bucket switcher",
                  body: "Fuzzy-jump to any bucket on any provider in two keystrokes. No re-authenticating, no logging into a separate console.",
               },
               {
                  icon: Cloud,
                  title: "Restricted-token friendly",
                  body: "Have a token without ListBuckets permission? Pin an allowed-bucket whitelist when you connect — S3 Viewer skips the listing call and works from your list.",
               },
               {
                  icon: Github,
                  title: "MIT-licensed, self-hostable",
                  body: "Free to use, free to fork. Self-host the same multi-cloud UI inside your VPC and credentials never leave your network.",
               },
            ]}
            steps={steps}
            faqs={faqs}
            relatedHowTos={getRelatedHowTos([
               "view-s3-and-r2-side-by-side",
               "switch-between-s3-buckets",
               "search-across-s3-buckets",
            ])}
            related={getRelated(SLUG)}
         />
      </>
   );
};

Page.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default Page;
