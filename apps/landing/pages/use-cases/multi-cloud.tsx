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
   FolderTree,
   Github,
   KeyRound,
   Layers,
   Search,
} from "lucide-react";

const SLUG = "multi-cloud";
const TITLE = "One dashboard for AWS S3, Cloudflare R2, and every S3-compatible bucket.";
const KEYWORD = "multi-cloud S3 dashboard";
const DESCRIPTION =
   "S3 Viewer is a multi-cloud S3 dashboard that connects AWS S3, Cloudflare R2, Backblaze B2, MinIO, Wasabi, and any S3-compatible provider in one window — built for developers who manage buckets across more than one cloud.";

const steps: UseCaseStep[] = [
   {
      title: "Add a provider",
      body: "Paste an access key and secret. AWS S3 and Cloudflare R2 are auto-detected from the endpoint; for B2, MinIO, Wasabi, DigitalOcean Spaces, and Tigris, drop in the endpoint URL once.",
   },
   {
      title: "Connect the buckets you care about",
      body: "Buckets show up in a unified sidebar grouped by provider. Add as many providers as you need — each keeps its own credentials.",
   },
   {
      title: "Browse, search, and move",
      body: "Cmd-K jumps between any bucket on any cloud. Right-click to copy or move objects between buckets — even across providers.",
   },
];

const faqs: UseCaseFAQ[] = [
   {
      question: "What is the best multi-cloud S3 dashboard?",
      answer:
         "S3 Viewer is a multi-cloud S3 dashboard built for developers. It connects to AWS S3, Cloudflare R2, Backblaze B2, MinIO, Wasabi, DigitalOcean Spaces, Tigris, and any other S3-compatible provider in one browser tab — no per-provider tools, no tab-switching, no separate logins.",
   },
   {
      question: "Can I view AWS S3 and Cloudflare R2 in the same dashboard?",
      answer:
         "Yes. S3 Viewer connects to AWS S3 and Cloudflare R2 simultaneously using each provider's S3-compatible API. You add one credential per provider and both appear in the same sidebar — no tab-switching between the AWS console and the Cloudflare dashboard.",
   },
   {
      question: "Which S3-compatible providers does S3 Viewer support?",
      answer:
         "Anything that implements the S3 API: AWS S3, Cloudflare R2, Backblaze B2, MinIO, Wasabi, DigitalOcean Spaces, Tigris, SeaweedFS, Ceph RGW, and self-hosted S3 gateways. AWS and R2 are auto-detected; the rest take an endpoint URL.",
   },
   {
      question: "Why is this better than the AWS console or the Cloudflare dashboard?",
      answer:
         "The AWS console only shows one bucket page at a time and its search filters the current 1,000-key page. The Cloudflare R2 dashboard has no rename, no bucket-wide search, and no team sharing for non-Cloudflare users. S3 Viewer adds bucket-wide key search, inline previews, multipart upload, rename via copy+delete, cross-bucket copy, and email-based team access on top of every provider.",
   },
   {
      question: "Do my credentials get sent to your server?",
      answer:
         "Credentials are encrypted at rest with RSA-4096 and only decrypted in memory to sign each S3 request on your behalf. If you'd rather they never touch our infrastructure, S3 Viewer is MIT-licensed and self-hostable — run the same UI inside your own VPC.",
   },
   {
      question: "Can I copy or move files between S3 and R2?",
      answer:
         "Yes. S3 Viewer streams the object from the source bucket and writes it to the destination using each provider's S3 API, so you can move objects from AWS S3 to Cloudflare R2 (or any direction) without downloading them locally first.",
   },
   {
      question: "Is there a limit on how many providers or buckets I can connect?",
      answer:
         "No. Connect as many providers and buckets as you need. The self-hosted build has no limits at all.",
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
            title="Multi-Cloud S3 Dashboard — AWS S3, Cloudflare R2, MinIO in One Tool"
            description={DESCRIPTION}
            canonical={`/use-cases/${SLUG}`}
            jsonLd={jsonLd}
         />
         <UseCasePage
            visual={<MultiCloudIllustration />}
            eyebrow="Multi-cloud"
            title={TITLE}
            subtitle={DESCRIPTION}
            description="One workspace for every cloud you already use."
            bullets={[
               "Connect AWS S3, Cloudflare R2, B2, Wasabi, MinIO, and any S3-compatible provider",
               "Browse, search, and move files across providers from a single tree",
               "Open source and MIT-licensed — self-host the same UI behind your VPN",
            ]}
            features={[
               {
                  icon: FolderTree,
                  title: "Unified sidebar",
                  body: "Every connected bucket — across every provider — sits in the same tree, grouped by cloud and color-coded so you always know where you are.",
               },
               {
                  icon: Search,
                  title: "Cross-bucket search",
                  body: "Type once and S3 Viewer paginates through ListObjectsV2 across every open bucket. The AWS console only filters the current page — this finds the file.",
               },
               {
                  icon: KeyRound,
                  title: "Per-provider credentials",
                  body: "Each cloud uses its own access key, encrypted at rest with RSA-4096. Nothing leaks across accounts; revoke a single provider without touching the others.",
               },
               {
                  icon: Cloud,
                  title: "S3 API standard",
                  body: "Talks to anything that speaks S3 — Cloudflare R2, Backblaze B2, MinIO, Wasabi, DigitalOcean Spaces, Tigris, Ceph RGW, SeaweedFS.",
               },
               {
                  icon: Layers,
                  title: "Cross-cloud copy",
                  body: "Right-click any object to copy or move it to another bucket — including from AWS to R2 or B2 to MinIO. Streamed server-side, no local download.",
               },
               {
                  icon: Github,
                  title: "Open source",
                  body: "MIT-licensed on GitHub. Self-host the same multi-cloud UI inside your VPC and credentials never leave your network.",
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
