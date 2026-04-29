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
   "S3 Viewer is a Cloudflare R2 dashboard for browsing, searching, renaming, uploading, and sharing R2 objects — beyond what the Cloudflare console offers. Mix R2 with AWS S3, MinIO, and B2 in the same window.";

const steps: UseCaseStep[] = [
   {
      title: "Generate an R2 API token",
      body: "In the Cloudflare dashboard, create an R2 API token scoped to the buckets you want to expose. Copy the access key ID, secret, and your account's S3 endpoint (account.r2.cloudflarestorage.com).",
   },
   {
      title: "Paste it into S3 Viewer",
      body: "S3 Viewer detects R2 from the endpoint and applies the correct region settings automatically. No SDK config, no wrangler, no AWS CLI.",
   },
   {
      title: "Start using R2 like a real bucket",
      body: "Browse with bucket-wide search, preview images and PDFs inline, rename objects (R2 has no rename API — we handle it), upload with multipart, and invite teammates by email.",
   },
];

const faqs: UseCaseFAQ[] = [
   {
      question: "Is there a better dashboard for Cloudflare R2?",
      answer:
         "Yes. S3 Viewer is a Cloudflare R2 dashboard built for the people who actually open R2 buckets every day. The Cloudflare console covers basics; S3 Viewer adds bucket-wide key search, inline file previews, rename via copy+delete, multipart uploads with retries, team sharing by email, and side-by-side viewing with AWS S3 buckets.",
   },
   {
      question: "How do I rename a file in Cloudflare R2?",
      answer:
         "R2 implements the S3 API and has no native rename — same as S3. The standard pattern is copy the object to the new key and delete the old one. S3 Viewer does this atomically and surfaces it as a single rename action with the same UX as renaming a file on your desktop.",
   },
   {
      question: "Can I share a Cloudflare R2 bucket with someone who doesn't have a Cloudflare account?",
      answer:
         "Yes. Invite them to your S3 Viewer workspace by email and grant them a role on the R2 bucket. They sign in to S3 Viewer in a browser and see the bucket — they never touch the Cloudflare dashboard or need a Cloudflare login.",
   },
   {
      question: "Does S3 Viewer work with R2 custom domains?",
      answer:
         "Yes. You connect via the S3 API endpoint (account.r2.cloudflarestorage.com or jurisdiction-specific equivalents). Public custom domains continue serving files normally — S3 Viewer is the management layer, not a CDN.",
   },
   {
      question: "Are large uploads to R2 reliable?",
      answer:
         "Yes. Files over the multipart threshold (50 MB) are split into 25 MB parts and uploaded in parallel via R2's S3-compatible multipart upload API. Failed parts retry without restarting the whole upload.",
   },
   {
      question: "Can I view AWS S3 and Cloudflare R2 in the same window?",
      answer:
         "Yes. Connect both providers — S3 Viewer keeps separate signers per cloud and shows every bucket in one sidebar, color-coded by provider. Use Cmd-K to jump between any bucket on any cloud.",
   },
   {
      question: "Why not just use the Cloudflare R2 console?",
      answer:
         "The R2 console is fine for creating buckets and managing tokens. It's not built for browsing — there's no rename, no bucket-wide search across millions of keys, no inline preview for most file types, no multipart UI feedback, and no way to give a non-Cloudflare user access to one bucket. S3 Viewer fills the gap.",
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
            title="Cloudflare R2 Dashboard — Browse, Rename, Share R2 Buckets"
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
               "Bucket-wide search, inline previews, and rename for R2 — none of which the Cloudflare console offers",
               "Share R2 buckets with teammates and clients by email — no Cloudflare account required",
               "Mix R2 buckets with AWS S3, MinIO, and B2 in one sidebar",
            ]}
            features={[
               {
                  icon: KeyRound,
                  title: "R2-aware connection",
                  body: "Paste your R2 access key, secret, and S3 endpoint — S3 Viewer detects R2 automatically and configures the right region settings.",
               },
               {
                  icon: Eye,
                  title: "Inline R2 previews",
                  body: "Images, video, audio, PDFs, Markdown, JSON, and source code render in the browser. The Cloudflare console downloads them.",
               },
               {
                  icon: PencilLine,
                  title: "Rename in R2",
                  body: "R2 has no rename API. S3 Viewer copies the object to the new key, verifies, then deletes the old one — surfaced as a single rename.",
               },
               {
                  icon: Upload,
                  title: "Multipart uploads",
                  body: "Files over 50 MB upload in parallel parts via R2's S3-compatible multipart API, with automatic retries on failed parts.",
               },
               {
                  icon: UserPlus,
                  title: "Share without Cloudflare access",
                  body: "Invite teammates and clients by email. They sign in to S3 Viewer and see the R2 bucket without ever touching the Cloudflare dashboard.",
               },
               {
                  icon: Layers,
                  title: "Mix R2 with S3",
                  body: "Open an R2 bucket and an AWS S3 bucket from the same sidebar. Copy or move objects between providers without downloading them locally.",
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
