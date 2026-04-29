import { getRelatedHowTos } from "@/components/HowTo/data";
import HowToPage, {
   type HowToFAQ,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import { buildHowToJsonLd } from "@/components/HowTo/jsonld";
import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { getUseCaseRefs } from "@/components/UseCases/data";
import { UploadIllustration } from "@/components/UseCases/illustrations";
import { SITE_URL } from "@/lib/site-config";

const SLUG = "upload-large-files-to-s3";
const TITLE = "How to upload large files to S3 (multipart upload)";
const KEYWORD = "upload large files to S3";
const TLDR =
   "Amazon S3's single PutObject caps at 5 GB and is non-resumable — a network blip on a 4 GB upload restarts from byte zero. The S3 multipart upload API (5 MB minimum part, 10,000 max parts, 5 TB ceiling) splits the file into pieces, uploads them in parallel, and lets you retry only the failed parts. S3 Viewer wraps that automatically above 50 MB with presigned per-part URLs, so the browser uploads directly to the bucket without your access key ever leaving the server.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: drop the file in",
      body: (
         <>
            Multipart kicks in automatically above 50 MB — S3 Viewer
            splits the file into 25 MB parts and uploads them in
            parallel via presigned per-part URLs signed server-side.
            Your browser uploads directly to S3 (or R2, or MinIO);
            nothing streams through our server.
         </>
      ),
   },
   {
      title: "Failed parts retry without restarting",
      body: (
         <>
            If your connection drops on part 47 of 200, only that part
            redoes — not the first 46.
         </>
      ),
   },
   {
      title: "AWS CLI: aws s3 cp",
      body: (
         <>
            The CLI uses multipart automatically above 8 MB. No flags
            needed for normal files; tune{" "}
            <code>multipart_chunksize</code> in your AWS config for very
            large ones.
         </>
      ),
      code: "aws s3 cp big.zip s3://bucket/big.zip",
   },
   {
      title: "AWS SDK: Upload from @aws-sdk/lib-storage",
      body: (
         <>
            Handles part splitting, parallelism, and retries for you.
            The right pattern for streaming uploads from a backend.
         </>
      ),
      code: "import { Upload } from '@aws-sdk/lib-storage';\n\nconst u = new Upload({\n  client: s3,\n  params: { Bucket: 'b', Key: 'big.zip', Body: stream },\n  queueSize: 4,    // parts in flight\n  partSize: 8 * 1024 * 1024,\n});\nawait u.done();",
   },
   {
      title: "Tune part size for very large files",
      body: (
         <>
            Default <code>partSize</code> in the SDK is 5 MB; raise to
            64–100 MB for files over 50 GB so you don&apos;t hit the
            10,000-parts cap. Math: max object size = partSize × 10,000.
         </>
      ),
   },
   {
      title: "Verify with HeadObject",
      body: (
         <>
            After the upload completes, confirm the size and ETag match
            what you intended to upload.
         </>
      ),
      code: "aws s3api head-object --bucket b --key big.zip",
   },
   {
      title: "Set a lifecycle rule to abort failed uploads",
      body: (
         <>
            Incomplete multipart uploads sit in the bucket and you pay
            for them until aborted. Add an S3 lifecycle rule to
            auto-abort uploads older than a few days — AWS recommends
            this in the well-architected framework.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "What's the max file size I can upload to S3?",
      answer:
         "5 GB with a single PutObject; 5 TB per object with multipart upload (10,000 parts × 5 GB each). Browser-based uploads in any dashboard run into network and timeout limits long before that, which is why multipart with presigned per-part URLs is the right pattern for large files — each part is its own request, retried independently.",
   },
   {
      question: "What is multipart upload in S3?",
      answer:
         "A three-step S3 API flow — CreateMultipartUpload, UploadPart (in parallel, 5 MB minimum each, up to 10,000 parts), and CompleteMultipartUpload. It splits a large file into pieces, uploads them in parallel, and lets you retry only the failed parts. Required for anything over 5 GB; recommended for anything over 100 MB.",
   },
   {
      question: "What happens if my upload fails halfway?",
      answer:
         "With single PutObject, you start over from byte zero. With multipart upload, only the failed parts retry — completed parts stay completed. S3 Viewer retries failed parts automatically, so a flaky connection doesn't cost you the whole upload.",
   },
   {
      question: "Do I get charged for failed multipart uploads?",
      answer:
         "Yes — incomplete multipart uploads are stored and billed at standard storage rates until you abort them. Set an S3 lifecycle rule to auto-abort incomplete uploads after a few days.",
   },
   {
      question: "Does Cloudflare R2 support multipart upload?",
      answer:
         "Yes. R2 implements the same S3 multipart upload API. The same multipart pattern (and the same SDKs) works against R2 buckets without changes — Cloudflare's S3 compatibility is what makes this possible.",
   },
   {
      question: "How do I upload large files to S3 from a browser safely?",
      answer:
         "Use presigned URLs for each part. Your backend issues a presigned URL per part via CreateMultipartUpload, the browser uploads parts directly to S3 in parallel, and the backend completes the upload. S3 Viewer's web upload uses exactly this pattern — your file goes browser → S3 directly, the access key never reaches the client, and each presigned URL is short-lived.",
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
            title="How to Upload Large Files to S3 (Multipart, Browser, CLI)"
            description="Use S3 multipart upload for files over 100 MB. Parts upload in parallel, failed parts retry independently, and objects up to 5 TB are supported."
            canonical={`/how-to/${SLUG}`}
            jsonLd={jsonLd}
         />
         <HowToPage
            eyebrow={TITLE}
            title={TITLE}
            tldr={TLDR}
            visual={<UploadIllustration />}
            steps={steps}
            underTheHood={
               <p>
                  S3&apos;s <code>PutObject</code> caps at 5 GB and is
                  non-resumable — a network blip on a 4 GB upload
                  restarts from byte zero. Multipart upload (
                  <code>CreateMultipartUpload</code> → many{" "}
                  <code>UploadPart</code> →{" "}
                  <code>CompleteMultipartUpload</code>) splits the file
                  into parts (5 MB minimum, 10,000 parts max), uploads
                  them in parallel, and lets you retry only the failed
                  parts. It supports objects up to 5 TB. S3 Viewer uses
                  multipart above 50 MB by default with 25 MB part sizes
                  and automatic retries; per-part URLs are presigned
                  server-side so your browser uploads directly to the
                  bucket — never through our infrastructure. The same
                  pattern works against Cloudflare R2, MinIO, B2, and
                  any other S3-compatible provider.
               </p>
            }
            faqs={faqs}
            useCases={getUseCaseRefs(["s3-browser", "cloudflare-r2"])}
            related={getRelatedHowTos([
               "download-file-from-s3",
               "rename-s3-file",
               "delete-file-from-s3",
            ])}
         />
      </>
   );
};

Page.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default Page;
