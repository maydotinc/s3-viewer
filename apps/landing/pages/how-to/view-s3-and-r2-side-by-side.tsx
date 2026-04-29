import { getRelatedHowTos } from "@/components/HowTo/data";
import HowToPage, {
   type HowToFAQ,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import { buildHowToJsonLd } from "@/components/HowTo/jsonld";
import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { getUseCaseRefs } from "@/components/UseCases/data";
import { SideBySideIllustration } from "@/components/UseCases/illustrations";
import { SITE_URL } from "@/lib/site-config";

const SLUG = "view-s3-and-r2-side-by-side";
const TITLE = "How to view AWS S3 and Cloudflare R2 in one dashboard";
const KEYWORD = "view S3 and R2 together";
const TLDR =
   "Each provider's native console focuses on its own service — exactly what you'd expect. To work across them, you need a third tool. Cloudflare R2's S3-compatible API is what makes this possible: any S3 client can talk to both. In S3 Viewer, connect each provider with one credential and they appear together in one sidebar — Cmd-K jumps anywhere, and right-click copies or moves objects across clouds.";

const steps: HowToStep[] = [
   {
      title: "Add AWS S3",
      body: (
         <>
            Paste an AWS access key and secret. S3 Viewer detects AWS
            from the endpoint and applies the right region — no SDK
            config, no <code>aws configure</code>.
         </>
      ),
   },
   {
      title: "Add Cloudflare R2",
      body: (
         <>
            In the Cloudflare dashboard, create an R2 API token. Paste
            the access key, secret, and your account&apos;s S3 endpoint
            (account.r2.cloudflarestorage.com). S3 Viewer detects R2
            automatically.
         </>
      ),
   },
   {
      title: "Both providers in the same sidebar",
      body: (
         <>
            Buckets are grouped and color-coded by provider, so you
            always know whether you&apos;re looking at S3 or R2. Add as
            many providers as you want — MinIO, B2, Wasabi, DigitalOcean
            Spaces, Tigris all work the same way.
         </>
      ),
   },
   {
      title: "Jump with Cmd-K",
      body: (
         <>
            Hit <code>Cmd-K</code> and type any part of a bucket name to
            fuzzy-jump to it — across providers, across accounts, no
            re-authenticating.
         </>
      ),
   },
   {
      title: "Search across both",
      body: (
         <>
            Type into the search bar to match keys across the buckets
            you have open. Tab autocompletes the next prefix. S3 Viewer
            paginates ListObjectsV2 across both providers and surfaces
            hits with the full key path.
         </>
      ),
   },
   {
      title: "Copy or move between providers",
      body: (
         <>
            Right-click any object and choose Copy or Move. S3 Viewer
            streams the bytes server-side from the source bucket and
            writes them to the destination — including from AWS S3 to
            R2 (or any direction). No local download, no re-upload,
            metadata and tags preserved by default.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "Can I manage AWS S3 and Cloudflare R2 in one tool?",
      answer:
         "Yes. R2 implements the S3 API, so a single S3 client can talk to both. In S3 Viewer, connect each provider with its own credential — both appear in the same sidebar, you can search across them, and you can copy or move objects between them server-side. Each provider's native console is focused on its own service, which is exactly what they're designed for; S3 Viewer is the layer for cross-provider work.",
   },
   {
      question: "How does R2 work with the S3 API?",
      answer:
         "Cloudflare R2 exposes an S3-compatible endpoint at <account>.r2.cloudflarestorage.com. Any S3 client (the AWS SDKs, the AWS CLI with --endpoint-url, or S3 Viewer) can list, get, put, copy, and delete objects against R2 the same way it does against AWS S3. Cloudflare's investment in S3 compatibility is what makes a tool like S3 Viewer possible at all.",
   },
   {
      question: "Do I need separate credentials for each cloud?",
      answer:
         "Yes — one access key per cloud. S3 Viewer doesn't replace your AWS or Cloudflare accounts; it sits on top of them and signs requests using whichever credential matches the bucket. Each is encrypted at rest with RSA-4096 and decrypted only in memory at request time.",
   },
   {
      question: "Can I copy a file from S3 to R2 (or R2 to S3)?",
      answer:
         "Yes. Right-click the file in S3 Viewer and choose Copy or Move to a bucket on the other provider. S3 Viewer streams the object server-side — no local download — and writes it to the destination using each provider's S3 API. Metadata and tags are preserved by default.",
   },
   {
      question: "Why use a third tool instead of two browser tabs?",
      answer:
         "Two browser tabs work fine if you're rarely in both. Once you cross-reference often or copy data between them, the context-switch cost adds up — separate logins, separate UIs, no cross-search, no cross-copy. One dashboard means you stay in flow.",
   },
];

const Page = () => {
   const jsonLd = buildHowToJsonLd({
      slug: SLUG,
      title: TITLE,
      tldr: TLDR,
      siteUrl: SITE_URL,
      steps,
      faqs,
      keyword: KEYWORD,
   });

   return (
      <>
         <Seo
            title="View AWS S3 and Cloudflare R2 in One Dashboard (Cross-Cloud Copy)"
            description="Connect AWS S3 and Cloudflare R2 to one dashboard, search across them, and copy files server-side between providers."
            canonical={`/how-to/${SLUG}`}
            jsonLd={jsonLd}
         />
         <HowToPage
            eyebrow={TITLE}
            title={TITLE}
            tldr={TLDR}
            visual={<SideBySideIllustration />}
            steps={steps}
            underTheHood={
               <p>
                  R2, B2, MinIO, and Wasabi all implement the S3 API,
                  which is why a single client can talk to all of them —
                  the only differences are endpoints and signing nuances.
                  S3 Viewer keeps a separate signer per provider so
                  credentials never cross-contaminate, and presents the
                  union as one tree. Cross-provider copies stream through
                  the server because most S3-compatible providers
                  don&apos;t support <code>CopyObject</code> across
                  endpoints — we read from the source and write to the
                  destination on your behalf, preserving metadata and
                  tags by default.
               </p>
            }
            faqs={faqs}
            useCases={getUseCaseRefs(["multi-cloud", "cloudflare-r2"])}
            related={getRelatedHowTos([
               "switch-between-s3-buckets",
               "search-across-s3-buckets",
               "upload-large-files-to-s3",
            ])}
         />
      </>
   );
};

Page.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default Page;
