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
   KeyRound,
   Layers,
   Pin,
   Search,
} from "lucide-react";

const SLUG = "multi-cloud";
const TITLE = "One window for every S3-compatible bucket you own.";
const KEYWORD = "multi-cloud S3 dashboard";
const DESCRIPTION =
   "S3 Viewer is a multi-cloud S3 dashboard that connects AWS S3, Cloudflare R2, Backblaze B2, MinIO, and Wasabi at once — no tab-switching, no separate tools.";

const steps: UseCaseStep[] = [
   {
      title: "Add your providers",
      body: "Paste an access key and secret for each cloud. Endpoints autofill for R2, B2, MinIO, and Wasabi.",
   },
   {
      title: "Pick the buckets you want",
      body: "Buckets show up in a unified sidebar grouped by provider, color-coded so you always know which cloud you're in.",
   },
   {
      title: "Browse anywhere",
      body: "Search and download files from any provider without re-authenticating. Drag a file from S3 to R2 to copy.",
   },
];

const faqs: UseCaseFAQ[] = [
   {
      question: "Can I view AWS S3 and Cloudflare R2 in the same dashboard?",
      answer:
         "Yes. S3 Viewer connects to AWS S3 and Cloudflare R2 simultaneously using each provider's S3-compatible API. You add one credential per provider, and both appear in the same sidebar — no tab-switching.",
   },
   {
      question: "Which S3-compatible providers does S3 Viewer support?",
      answer:
         "AWS S3, Cloudflare R2, Backblaze B2, MinIO, Wasabi, DigitalOcean Spaces, Tigris, and any other provider that implements the S3 API. Endpoints for R2, B2, Wasabi, and MinIO are preconfigured.",
   },
   {
      question: "Do my credentials get sent to your server?",
      answer:
         "Credentials are encrypted at rest and only used server-side to sign S3 requests on your behalf. You can also self-host the open-source build so credentials never leave your network.",
   },
   {
      question: "Can I move files between S3 and R2?",
      answer:
         "Yes. You can copy files across providers from the UI; S3 Viewer streams the object from the source bucket and writes it to the destination using each provider's S3 API.",
   },
   {
      question:
         "Is there a limit on how many providers or buckets I can connect?",
      answer:
         "No hard limit on the hosted plan, and no limit at all on the self-hosted build.",
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
            title="Multi-Cloud S3 Dashboard — View S3 and R2 Together"
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
               "Connect AWS, R2, B2, Wasabi, and MinIO with one credential per provider",
               "Browse, search, and move files across providers from a single tree",
               "Pin frequent buckets across clouds for one-click access",
            ]}
            features={[
               {
                  icon: FolderTree,
                  title: "Unified tree",
                  body: "Every connected bucket shows up in the same sidebar, grouped by provider.",
               },
               {
                  icon: Search,
                  title: "Cross-provider search",
                  body: "Type once, search every bucket you have access to.",
               },
               {
                  icon: KeyRound,
                  title: "Per-provider credentials",
                  body: "Each cloud uses its own keys; nothing leaks across accounts.",
               },
               {
                  icon: Cloud,
                  title: "Endpoint presets",
                  body: "R2, B2, Wasabi, and MinIO endpoints are preconfigured.",
               },
               {
                  icon: Layers,
                  title: "Mixed sessions",
                  body: "Open an R2 bucket and an S3 bucket side by side in tabs.",
               },
               {
                  icon: Pin,
                  title: "Open source",
                  body: "Self-host the same multi-cloud UI behind your VPN if you prefer.",
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
