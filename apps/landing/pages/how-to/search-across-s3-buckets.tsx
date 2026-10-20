import {
   createHowToPage,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import type { Faq } from "@/lib/types";
import { SearchIllustration } from "@/components/UseCases/illustrations/how-to/search";

const SLUG = "search-across-s3-buckets";
const TLDR =
   "Amazon S3 has no native search API — every tool lists keys with ListObjectsV2 and filters them. S3 Viewer's “Filter by prefix” box is exactly that — a prefix filter over the folder you are currently in: it narrows the rows on screen and does not walk into subfolders or other buckets. For a recursive sweep, aws s3 ls --recursive | grep is fast enough on small to medium buckets. For buckets with millions of keys, S3 Inventory + Athena is the right pattern.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: filter the current folder",
      body: (
         <>
            Type in the <strong>Filter by prefix</strong> box above the file
            list. It filters the rows in the folder you are looking at by key
            prefix, as you type — both folders and objects. It does not recurse
            into subfolders and it does not span buckets, so navigate into the
            prefix you care about first.
         </>
      ),
   },
   {
      title: "Open the result",
      body: (
         <>
            Click a folder to move into it and filter again, or click an object
            to preview it. The breadcrumb above the list shows the prefix you
            are filtering inside.
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
            Use <code>--prefix</code> to narrow the listing first, then filter
            the output. Faster on large buckets — listing happens server-side.
         </>
      ),
      code: "aws s3api list-objects-v2 \\\n  --bucket my-bucket \\\n  --prefix logs/2026/ \\\n  --query 'Contents[?Size > `1000000`]'",
   },
   {
      title: "For very large buckets: S3 Inventory + Athena",
      body: (
         <>
            Enable S3 Inventory for a daily CSV/Parquet manifest of every key,
            then query it with Athena. The right pattern for buckets with
            millions or billions of objects — listing them via the API would
            take hours.
         </>
      ),
   },
];

const faqs: Faq[] = [
   {
      question: "How do I search for a file in an S3 bucket?",
      answer:
         "S3 has no search API — you list keys with ListObjectsV2 and filter them. From the CLI: aws s3 ls s3://bucket --recursive | grep <query>. From a tool: open the folder in S3 Viewer and type in the “Filter by prefix” box — it filters that folder's rows by prefix as you type. For a recursive search across a whole bucket, use the CLI; for buckets with millions of objects, use S3 Inventory + Athena.",
   },
   {
      question: "Why doesn't the AWS S3 console search find my file?",
      answer:
         "The console's search filters the keys currently visible on the page (typically 1,000 keys) and inside the current prefix. S3 Viewer's “Filter by prefix” box behaves the same way — it is a prefix filter on the folder you are in. For a genuinely bucket-wide sweep you need a recursive listing: aws s3 ls s3://bucket --recursive | grep <query>, or S3 Inventory + Athena on very large buckets.",
   },
   {
      question: "Can I search across multiple S3 buckets at once?",
      answer:
         "Not yet — search in S3 Viewer is per bucket and per folder. It filters the current folder's rows by prefix. From the CLI you'd loop over a list of buckets and grep each one; there is no native multi-bucket search API either.",
   },
   {
      question: "How do I search a Cloudflare R2 bucket?",
      answer:
         "R2 implements ListObjectsV2 and works the same way as S3. From the AWS CLI with --endpoint-url: aws s3 ls --endpoint-url https://<account>.r2.cloudflarestorage.com --recursive | grep <query>. From S3 Viewer, type in the “Filter by prefix” box — R2 folders filter exactly like S3 folders.",
   },
   {
      question: "Is there an S3 search API?",
      answer:
         "No — S3's only listing primitive is ListObjectsV2 with prefix and delimiter. For real search (full-text, by metadata, by content), build it on top of S3 Inventory + Athena, or index the bucket into a search engine like OpenSearch.",
   },
];

export default createHowToPage({
   slug: SLUG,
   heading: "How to search inside an S3 bucket",
   tldr: TLDR,
   seoTitle: "Search Inside an S3 Bucket: Prefix, CLI, Athena",
   seoDescription:
      "Three ways to search S3: a prefix filter on the current folder in S3 Viewer, a recursive listing from the AWS CLI, or S3 Inventory + Athena.",
   published: "2026-04-28",
   updated: "2026-10-12",
   visual: <SearchIllustration />,
   steps,
   underTheHood: (
      <p>
         S3 has no search API. Its only listing primitive is{" "}
         <code>ListObjectsV2</code> with a prefix and a delimiter, which is
         exactly what a folder view is: the delimiter groups everything below
         the current prefix into &ldquo;folders&rdquo;. S3 Viewer&apos;s{" "}
         <strong>Filter by prefix</strong> box works at that same level — it
         filters the rows already listed for the current prefix, so it is fast
         and predictable but scoped to one folder in one bucket. Anything
         recursive means walking the full listing yourself:{" "}
         <code>aws s3 ls --recursive</code> piped through <code>grep</code> for
         small and medium buckets, and S3 Inventory + Athena once a bucket has
         millions of keys. The same holds for Cloudflare R2, MinIO and Backblaze
         B2, since they implement the same listing API.
      </p>
   ),
   faqs,
   useCases: ["s3-browser", "multi-cloud"],
   related: [
      "create-folder-in-s3",
      "switch-between-s3-buckets",
      "view-s3-and-r2-side-by-side",
   ],
});
