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
   "Amazon S3 has no native search API — every tool lists keys with ListObjectsV2 and filters client-side. The trick is paginating through the full result set instead of stopping at the first 1,000-key page. For small to medium buckets, `aws s3 ls --recursive | grep` is fast enough. For interactive cross-bucket search across providers, S3 Viewer paginates in the background with Tab autocomplete. For buckets with millions of keys, S3 Inventory + Athena is the right pattern.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: type in the search bar",
      body: (
         <>
            Search runs as you type. Hit <code>Tab</code> to autocomplete
            the next prefix segment — finding{" "}
            <code>data/models/v2/training/checkpoint-42/weights.pt</code>{" "}
            becomes a few Tab presses. S3 Viewer paginates through{" "}
            <code>ListObjectsV2</code> in the background and filters
            in-memory across the buckets you have open — including
            buckets on different providers.
         </>
      ),
   },
   {
      title: "Open the result",
      body: (
         <>
            Hits show the full key path so you can see exactly where
            each match lives. Click to jump straight to the file.
         </>
      ),
   },
   {
      title: "AWS CLI: recursive list + grep",
      body: <>Quick and dirty. Works for small to medium buckets.</>,
      code: "aws s3 ls s3://my-bucket --recursive | grep <query>",
   },
   {
      title: "AWS CLI: list-objects-v2 with --prefix",
      body: (
         <>
            Use <code>--prefix</code> to narrow the listing first, then
            filter the output. Faster on large buckets — listing
            happens server-side.
         </>
      ),
      code: "aws s3api list-objects-v2 \\\n  --bucket my-bucket \\\n  --prefix logs/2026/ \\\n  --query 'Contents[?Size > `1000000`]'",
   },
   {
      title: "For very large buckets: S3 Inventory + Athena",
      body: (
         <>
            Enable S3 Inventory for a daily CSV/Parquet manifest of
            every key, then query it with Athena. The right pattern for
            buckets with millions or billions of objects — listing them
            via the API would take hours.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "How do I search for a file in an S3 bucket?",
      answer:
         "S3 has no search API — you list keys with ListObjectsV2 and filter client-side. From the CLI: `aws s3 ls s3://bucket --recursive | grep <query>`. From a tool: open the bucket in S3 Viewer and type in the search bar — it paginates ListObjectsV2 and filters as you type, with Tab autocomplete for prefix paths, across the entire bucket. For buckets with millions of objects, use S3 Inventory + Athena.",
   },
   {
      question: "Why doesn't the AWS S3 console search find my file?",
      answer:
         "The console's search filters the keys currently visible on the page (typically 1,000 keys). For a bucket-wide search you need a tool that paginates through ListObjectsV2 and applies the filter to every returned key. S3 Viewer does the pagination in the background, so a query in a 50,000-key bucket finds the file even when it's deep in the result set.",
   },
   {
      question: "Can I search across multiple S3 buckets at once?",
      answer:
         "Yes. S3 Viewer's search runs across every bucket you have open in the workspace, including buckets on different providers like Cloudflare R2 and Backblaze B2. From the CLI, you'd loop over a list of buckets and grep each one — there's no native multi-bucket search API.",
   },
   {
      question: "How do I search a Cloudflare R2 bucket?",
      answer:
         "R2 implements ListObjectsV2 and works the same way as S3. From the AWS CLI with `--endpoint-url`: `aws s3 ls --endpoint-url https://<account>.r2.cloudflarestorage.com --recursive | grep <query>`. From S3 Viewer, just type in the search bar — R2 buckets are searched the same as S3 buckets, with Tab autocomplete and bucket-wide pagination.",
   },
   {
      question: "Is there an S3 search API?",
      answer:
         "No — S3's only listing primitive is ListObjectsV2 with prefix and delimiter. For real search (full-text, by metadata, by content), build it on top of S3 Inventory + Athena, or index the bucket into a search engine like OpenSearch.",
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
            title="How to Search Across S3 Buckets (Tab Autocomplete, CLI, Athena)"
            description="Three patterns for searching S3 — bucket-wide with the CLI, cross-bucket with S3 Viewer, and across millions of keys with S3 Inventory + Athena."
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
                  <code>ListObjectsV2</code>) and filter client-side.
                  The AWS console&apos;s filter operates on the visible
                  page (1,000 keys), which is fine for small buckets
                  but not for deep ones. S3 Viewer paginates through{" "}
                  <code>ListObjectsV2</code> in the background and
                  filters in-memory; results stream in as pages come
                  back. Tab autocompletes the next prefix segment as
                  you type, so navigating deep paths is keyboard-fast.
                  The same pattern works for Cloudflare R2, MinIO,
                  Backblaze B2, and any other S3-compatible provider,
                  since they all implement the same listing API. For
                  multi-million-key buckets, S3 Inventory + Athena is
                  the right pattern.
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
