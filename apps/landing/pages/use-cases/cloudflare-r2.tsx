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
   Layers,
   PencilLine,
   Search,
   Upload,
   UserPlus,
} from "lucide-react";

const SLUG = "cloudflare-r2";
const TITLE = "A daily-use dashboard for Cloudflare R2.";
const KEYWORD = "Cloudflare R2 dashboard";
const DESCRIPTION =
   "Cloudflare R2's S3-compatible API is excellent — it's what lets any S3 client talk to R2 the same way it talks to AWS S3. The Cloudflare dashboard is built around configuration; S3 Viewer is the layer for daily browsing on top: rename, bucket-wide search, multipart upload, email invites, and side-by-side viewing with AWS S3 buckets.";

const steps: UseCaseStep[] = [
   {
      title: "Generate an R2 API token",
      body: "In the Cloudflare dashboard, create an R2 API token scoped to the buckets you want to expose. Copy the access key ID, secret, and your account's S3 endpoint (account.r2.cloudflarestorage.com).",
   },
   {
      title: "Paste it in",
      body: "S3 Viewer detects R2 from the endpoint automatically and applies the right region settings. No SDK config, no wrangler, no AWS CLI.",
   },
   {
      title: "Use R2 the way you'd use any bucket",
      body: "Rename objects (the underlying S3 API has no rename — we wrap copy + delete). Search the entire bucket with Tab autocomplete. Upload multi-GB files via multipart with retries. Invite teammates by email — they don't need a Cloudflare account.",
   },
];

const faqs: UseCaseFAQ[] = [
   {
      question: "Is there a better dashboard for Cloudflare R2?",
      answer:
         "S3 Viewer is built for the daily browsing layer on top of R2. The Cloudflare dashboard is the right place to create buckets, manage R2 API tokens, configure custom domains, and handle billing. S3 Viewer adds bucket-wide key search, inline file previews, one-click rename (wrapping the standard S3 copy + delete pattern), multipart uploads with retries, team sharing by email, and side-by-side viewing with AWS S3 — without you leaving the browser.",
   },
   {
      question: "How do I rename a file in Cloudflare R2?",
      answer:
         "R2 implements the S3 API, and Amazon S3 has no native rename — keys are immutable. The standard pattern is to copy the object to the new key and delete the old one. S3 Viewer wraps this in a single right-click: it copies the object, preserves metadata and tags by default, verifies the destination, then deletes the source. Above 5 GB it switches to multipart copy automatically.",
   },
   {
      question: "How do I search a Cloudflare R2 bucket?",
      answer:
         "R2 implements the S3 ListObjectsV2 API, so any S3 client can search by paginating through keys. S3 Viewer does this for you — type into the search bar, Tab to autocomplete the next prefix, and it paginates the whole bucket and filters as results stream in.",
   },
   {
      question: "Can I share a Cloudflare R2 bucket with someone who doesn't have a Cloudflare account?",
      answer:
         "Yes. Invite them to your S3 Viewer workspace by email and grant them a role on the R2 bucket — Viewer (read), Editor (read + write), Admin (everything). They sign in to S3 Viewer in a browser and see the bucket, with no Cloudflare account or API token of their own.",
   },
   {
      question: "Are large uploads to R2 reliable?",
      answer:
         "Yes. Files over 50 MB are split into 25 MB parts and uploaded in parallel via R2's S3-compatible multipart upload API. Failed parts retry without restarting the whole upload, so a connection blip on a multi-GB file doesn't cost you the upload.",
   },
   {
      question: "Can I view AWS S3 and Cloudflare R2 in the same window?",
      answer:
         "Yes. Connect both providers and S3 Viewer keeps a separate signer for each, with every bucket in one sidebar color-coded by provider. Cmd-K jumps between any bucket on any cloud, and you can copy or move objects between S3 and R2 (or any direction) — streamed server-side, no local download.",
   },
   {
      question: "Why use S3 Viewer alongside the Cloudflare dashboard?",
      answer:
         "Use the Cloudflare dashboard for what it's built for: buckets, tokens, custom domains, jurisdictional placement, billing. Use S3 Viewer for what it's built for: daily browsing — opening files, finding things across millions of keys, renaming, sharing with teammates, and copying across providers. They're complementary tools.",
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
            title="Cloudflare R2 Dashboard — Rename, Search, Share R2 Buckets"
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
               "Rename, bucket-wide search, and inline previews for R2 objects",
               "Share R2 buckets by email — no Cloudflare account required for the recipient",
               "Mix R2 buckets with AWS S3, MinIO, and B2 in one sidebar",
            ]}
            features={[
               {
                  icon: PencilLine,
                  title: "Rename in R2",
                  body: "R2 has no rename API — same as S3, by design. S3 Viewer wraps the standard copy + delete pattern in a single click, preserves metadata and tags, verifies the new key, then deletes the source.",
               },
               {
                  icon: Search,
                  title: "Bucket-wide R2 search",
                  body: "Type into the search bar and Tab autocompletes the next prefix. S3 Viewer paginates ListObjectsV2 across the whole R2 bucket and filters in-memory as results stream in.",
               },
               {
                  icon: Eye,
                  title: "Inline R2 previews",
                  body: "Images, video, audio, PDF, Markdown, JSON, and source code render in the browser via short-lived presigned URLs.",
               },
               {
                  icon: Upload,
                  title: "Multipart upload",
                  body: "Files over 50 MB upload in 25 MB parts in parallel via R2's S3-compatible multipart API, with automatic retries on failed parts.",
               },
               {
                  icon: UserPlus,
                  title: "Share without Cloudflare access",
                  body: "Invite teammates and clients by email. They sign in to S3 Viewer and see the R2 bucket — no Cloudflare account, no API token, no setup.",
               },
               {
                  icon: Layers,
                  title: "Mix R2 with S3",
                  body: "Open an R2 bucket and an AWS S3 bucket from the same sidebar. Right-click to copy or move objects between providers — streamed server-side, no local download.",
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
