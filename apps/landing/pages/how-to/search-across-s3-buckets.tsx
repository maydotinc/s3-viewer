import { getRelatedHowTos } from "@/components/HowTo/data";
import HowToPage, {
   type HowToFAQ,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import { buildHowToJsonLd } from "@/components/HowTo/jsonld";
import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { getUseCaseRefs } from "@/components/UseCases/data";
import { SearchIllustration } from "@/components/UseCases/illustrations";
import { SITE_URL } from "@/lib/site-config";

const SLUG = "search-across-s3-buckets";
const TITLE = "How to search across S3 buckets";
const KEYWORD = "search S3 buckets";
const TLDR =
   "The AWS console only filters the current page. To search a whole bucket use aws s3 ls --recursive | grep, or use S3 Viewer's bucket-wide and cross-bucket search.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: hit /",
      body: <>Type any part of the key. Search runs as you type.</>,
   },
   {
      title: "Switch scope",
      body: (
         <>
            Toggle between current prefix, current bucket, or every connected
            bucket — across providers.
         </>
      ),
   },
   {
      title: "Open the result",
      body: <>Hits show the full key path. Click to jump straight to the file.</>,
   },
   {
      title: "CLI alternative: recursive list + grep",
      body: <>Quick and dirty. Works for small to medium buckets.</>,
      code: "aws s3 ls s3://my-bucket --recursive | grep <query>",
   },
   {
      title: "CLI alternative: list-objects-v2 with prefix",
      body: (
         <>
            Use <code>--prefix</code> to narrow the listing first, then
            filter the output. Faster on large buckets.
         </>
      ),
      code:
         "aws s3api list-objects-v2 \\\n  --bucket my-bucket \\\n  --prefix logs/2026/ \\\n  --query 'Contents[?Size > `1000000`]'",
   },
   {
      title: "For very large buckets: S3 Inventory + Athena",
      body: (
         <>
            Enable S3 Inventory for a daily CSV/Parquet manifest of every
            key, then query it with Athena. The right pattern for buckets
            with millions of objects.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "How do I search for a file in an S3 bucket?",
      answer:
         "In S3 Viewer, hit / and type the key — it searches the whole bucket. From the CLI: aws s3 ls s3://bucket --recursive | grep <query>.",
   },
   {
      question: "Why doesn't the AWS console search find my file?",
      answer:
         "The console's filter only matches the current 1,000-key page. For a bucket-wide search you need a tool that paginates through ListObjectsV2.",
   },
   {
      question: "Can I search across multiple buckets at once?",
      answer:
         "Yes — S3 Viewer's search runs across every bucket open in the session, including buckets from different providers.",
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
            title="How to Search Across S3 Buckets"
            description="The AWS console search misses most files. Here's how to actually search S3 — bucket-wide, cross-bucket, and across millions of objects."
            canonical={`/how-to/${SLUG}`}
            jsonLd={jsonLd}
         />
         <HowToPage
            eyebrow={TITLE}
            title={TITLE}
            tldr={TLDR}
            visual={<SearchIllustration />}
            steps={steps}
            underTheHood={
               <p>
                  S3 has no search API — you list keys (
                  <code>ListObjectsV2</code>) and filter client-side. The
                  console&apos;s filter only matches the current page (1,000
                  keys), which is why finding things in a deep bucket is
                  painful. S3 Viewer paginates through{" "}
                  <code>ListObjectsV2</code> in the background and filters
                  in-memory; results stream in as pages come back. For
                  multi-million-key buckets, S3 Inventory + Athena is the
                  right pattern.
               </p>
            }
            faqs={faqs}
            useCases={getUseCaseRefs(["s3-browser", "multi-cloud"])}
            related={getRelatedHowTos([
               "switch-between-s3-buckets",
               "view-s3-and-r2-side-by-side",
               "rename-s3-file",
            ])}
         />
      </>
   );
};

Page.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default Page;
