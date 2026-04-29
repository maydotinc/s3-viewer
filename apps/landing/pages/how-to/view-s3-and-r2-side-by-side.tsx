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
const TITLE = "How to view AWS S3 and Cloudflare R2 side by side";
const KEYWORD = "view S3 and R2 together";
const TLDR =
   "Connect both providers to S3 Viewer with one credential each — they appear in the same sidebar and you can open them in side-by-side tabs.";

const steps: HowToStep[] = [
   {
      title: "Add AWS",
      body: <>Paste an AWS access key and secret. Region autodetects from your IAM.</>,
   },
   {
      title: "Add R2",
      body: (
         <>
            In Cloudflare, create an R2 API token. Paste the access key,
            secret, and account ID into S3 Viewer; the endpoint autofills.
         </>
      ),
   },
   {
      title: "Both buckets appear in the sidebar",
      body: <>Grouped by provider with color-coded labels.</>,
   },
   {
      title: "Open side by side",
      body: (
         <>
            Click one bucket, then <code>Cmd</code>-click another to open it
            in a split tab.
         </>
      ),
   },
   {
      title: "Search across both",
      body: (
         <>
            Hit <code>/</code>. Search runs against any bucket you have open.
         </>
      ),
   },
   {
      title: "Copy between them",
      body: (
         <>
            Select files in S3 and drag them to an R2 bucket. S3 Viewer
            streams the bytes server-side.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "Can I manage AWS S3 and Cloudflare R2 in one tool?",
      answer:
         "Yes. S3 Viewer connects to both at once; you add one credential per provider and both appear in the same sidebar.",
   },
   {
      question: "Do I need separate accounts for each cloud?",
      answer:
         "Yes — one access key per cloud. S3 Viewer doesn't replace your cloud accounts; it sits on top of them.",
   },
   {
      question: "Can I copy a file from S3 to R2?",
      answer:
         "Yes. Drag it across in the UI; S3 Viewer streams the object from S3 and writes it to R2.",
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
            title="How to View AWS S3 and Cloudflare R2 Side by Side"
            description="Connect AWS S3 and Cloudflare R2 to one dashboard. Browse, search, and copy files between providers without tab-switching."
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
