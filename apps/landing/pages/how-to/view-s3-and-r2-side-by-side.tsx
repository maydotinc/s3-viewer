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
   "AWS S3 and Cloudflare R2 both speak the S3 API, so the same client can talk to both. In S3 Viewer, connect each provider with its own credential and both appear in the same sidebar — Cmd-K jumps between any bucket on any cloud, and right-click moves objects across providers.";

const steps: HowToStep[] = [
   {
      title: "Add AWS S3",
      body: (
         <>
            Paste an AWS access key and secret. S3 Viewer detects AWS from
            the endpoint and applies the right region — no SDK config, no{" "}
            <code>aws configure</code>.
         </>
      ),
   },
   {
      title: "Add Cloudflare R2",
      body: (
         <>
            In the Cloudflare dashboard, create an R2 API token. Paste the
            access key, secret, and your account&apos;s S3 endpoint
            (account.r2.cloudflarestorage.com). S3 Viewer detects R2
            automatically.
         </>
      ),
   },
   {
      title: "Both providers show up in the sidebar",
      body: (
         <>
            Buckets are grouped by provider with color-coded labels, so you
            always know whether you&apos;re looking at S3 or R2.
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
            Type in the search bar to match keys across the buckets you have
            open. S3 Viewer paginates through{" "}
            <code>ListObjectsV2</code> for both providers and surfaces hits
            with the full key path.
         </>
      ),
   },
   {
      title: "Copy or move between them",
      body: (
         <>
            Right-click any object and choose Copy or Move. S3 Viewer streams
            the bytes server-side from the source bucket and writes them to
            the destination — including from AWS S3 to R2 (or any direction).
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "Can I manage AWS S3 and Cloudflare R2 in one tool?",
      answer:
         "Yes. R2 implements the S3 API, so a single S3 client can talk to both. In S3 Viewer, connect each provider with its own credential — both appear in the same sidebar, you can search across them, and you can copy or move objects between them server-side.",
   },
   {
      question: "How does R2 work with the S3 API?",
      answer:
         "Cloudflare R2 exposes an S3-compatible endpoint at <account>.r2.cloudflarestorage.com. Any S3 client (the AWS SDKs, the AWS CLI with --endpoint-url, or S3 Viewer) can list, get, put, copy, and delete objects against R2 the same way it does against AWS S3.",
   },
   {
      question: "Do I need separate credentials for each cloud?",
      answer:
         "Yes — one access key per cloud. S3 Viewer doesn't replace your AWS or Cloudflare accounts; it sits on top of them and signs requests using whichever credential matches the bucket.",
   },
   {
      question: "Can I copy a file from S3 to R2 (or R2 to S3)?",
      answer:
         "Yes. Right-click the file in S3 Viewer and choose Copy across to a bucket on the other provider. S3 Viewer streams the object server-side — no local download — and writes it to the destination using each provider's S3 API.",
   },
   {
      question: "Why not just use the AWS console plus the Cloudflare dashboard?",
      answer:
         "Two separate tabs, two separate logins, and neither one supports rename, bucket-wide search, or moving files between providers. Switching contexts every few minutes is the actual cost. One dashboard lets you stay in flow.",
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
            title="How to View AWS S3 and Cloudflare R2 in One Dashboard"
            description="Connect AWS S3 and Cloudflare R2 to one tool. Browse, search, and copy files between providers without tab-switching between consoles."
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
                  R2, B2, MinIO, and Wasabi all implement the S3 API, which
                  is why a single client can talk to all of them — the only
                  differences are endpoints and signing nuances. S3 Viewer
                  keeps a separate signer per provider so credentials never
                  cross-contaminate, and presents the union as one tree.
                  Cross-provider copies stream through the server because
                  most S3-compatible providers don&apos;t allow{" "}
                  <code>CopyObject</code> across endpoints.
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
