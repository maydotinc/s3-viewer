import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { getRelatedHowTos } from "@/components/HowTo/data";
import { getRelated } from "@/components/UseCases/data";
import { CloudflareR2Illustration } from "@/components/UseCases/illustrations";
import { buildUseCaseJsonLd } from "@/components/UseCases/jsonld";
import UseCasePage, {
   type UseCaseFAQ,
   type UseCaseStep,
} from "@/components/UseCases/use-case-page";
import { SITE_URL } from "@/lib/site-config";
import {
   Eye,
   KeyRound,
   Layers,
   PencilLine,
   Upload,
   UserPlus,
} from "lucide-react";

const SLUG = "cloudflare-r2";
const TITLE = "A real dashboard for Cloudflare R2.";
const KEYWORD = "Cloudflare R2 dashboard";
const DESCRIPTION =
   "S3 Viewer is a Cloudflare R2 dashboard for browsing, uploading, renaming, and sharing R2 objects — beyond what the Cloudflare console offers.";

const steps: UseCaseStep[] = [
   {
      title: "Generate an R2 token",
      body: "In the Cloudflare dashboard, create an R2 API token scoped to the buckets you want to expose.",
   },
   {
      title: "Paste it into S3 Viewer",
      body: "Endpoint, region, and account ID autofill — we wire up the rest.",
   },
   {
      title: "Start using R2",
      body: "Browse, upload, rename, share, and download. Mix R2 buckets with AWS buckets in the same window.",
   },
];

const faqs: UseCaseFAQ[] = [
   {
      question: "Is there a better dashboard for Cloudflare R2?",
      answer:
         "The Cloudflare console covers basics. S3 Viewer adds key search, inline previews, rename, multipart uploads with retries, team sharing, and side-by-side viewing with AWS S3 buckets.",
   },
   {
      question: "How do I rename a file in R2?",
      answer:
         "R2 follows the S3 API and doesn't expose a native rename. S3 Viewer copies the object to the new key and deletes the old one, presented as a single rename action — same UX as renaming a file on your desktop.",
   },
   {
      question:
         "Can I share an R2 bucket with someone who doesn't have a Cloudflare account?",
      answer:
         "Yes. Invite them to your S3 Viewer workspace by email and scope them to the R2 bucket. They never touch Cloudflare.",
   },
   {
      question: "Does this work with R2 custom domains?",
      answer:
         "Yes. Connect via the S3 API endpoint (<account>.r2.cloudflarestorage.com). Custom public domains continue to serve files normally.",
   },
   {
      question: "Are large uploads to R2 reliable?",
      answer:
         "Yes. Files over the threshold (default 100 MB) use S3 multipart upload with automatic retries on failed parts.",
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
            title="Cloudflare R2 Dashboard — Browse, Upload, Manage"
            description={DESCRIPTION}
            canonical={`/use-cases/${SLUG}`}
            jsonLd={jsonLd}
         />
         <UseCasePage
            visual={<CloudflareR2Illustration />}
            eyebrow="Cloudflare R2"
            title={TITLE}
            subtitle={DESCRIPTION}
            description="Built for the people who actually open R2 buckets every day."
            bullets={[
               "Browse R2 buckets with search, previews, and multi-select",
               "Rename R2 objects (R2 has no native rename — we handle it)",
               "Share R2 files with teammates by email, no Cloudflare account needed",
            ]}
            features={[
               {
                  icon: KeyRound,
                  title: "R2-aware endpoint",
                  body: "Add your R2 access key and account ID; we wire up the rest.",
               },
               {
                  icon: Eye,
                  title: "Preview-friendly",
                  body: "R2-hosted images, video, PDFs, and JSON preview inline.",
               },
               {
                  icon: PencilLine,
                  title: "Rename",
                  body: "R2 has no rename API — S3 Viewer copies + deletes atomically and shows it as one action.",
               },
               {
                  icon: Upload,
                  title: "Multipart upload",
                  body: "Drag-and-drop large files; we handle multipart and retries.",
               },
               {
                  icon: UserPlus,
                  title: "Share without Cloudflare access",
                  body: "Invite teammates to view a bucket without giving them a Cloudflare login.",
               },
               {
                  icon: Layers,
                  title: "Mix R2 with S3",
                  body: "View an R2 bucket and an S3 bucket side by side in the same window.",
               },
            ]}
            steps={steps}
            faqs={faqs}
            relatedHowTos={getRelatedHowTos([
               "rename-s3-file",
               "view-s3-and-r2-side-by-side",
               "upload-large-files-to-s3",
            ])}
            related={getRelated(SLUG)}
         />
      </>
   );
};

Page.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default Page;
