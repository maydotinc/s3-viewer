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
const TITLE = "How to upload large files to S3 (multipart)";
const KEYWORD = "upload large files to S3";
const TLDR =
   "Use multipart upload for anything over 100 MB — files split into parts, upload in parallel, and reassemble. S3 Viewer does this automatically when you drag a file in.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: drag the file in",
      body: <>Multipart kicks in automatically above the threshold (default 100 MB).</>,
   },
   {
      title: "Watch the per-part progress",
      body: <>Failed parts retry without restarting the whole upload.</>,
   },
   {
      title: "CLI alternative: aws s3 cp",
      body: <>The CLI uses multipart automatically above 8 MB.</>,
      code: "aws s3 cp big.zip s3://bucket/big.zip",
   },
   {
      title: "SDK alternative: Upload from @aws-sdk/lib-storage",
      body: <>Handles part splitting and retries for you.</>,
      code:
         "import { Upload } from '@aws-sdk/lib-storage';\n\nconst u = new Upload({\n  client: s3,\n  params: { Bucket: 'b', Key: 'big.zip', Body: stream },\n});\nawait u.done();",
   },
   {
      title: "Set part size for very large files",
      body: (
         <>
            Default <code>partSize</code> is 8 MB; raise to 64–100 MB for
            files over 50 GB. Max 10,000 parts per upload.
         </>
      ),
   },
   {
      title: "Confirm with HeadObject",
      body: (
         <>
            Verify size and ETag match what you intended to upload.
         </>
      ),
      code: "aws s3api head-object --bucket b --key big.zip",
   },
   {
      title: "Set a lifecycle rule for failed uploads",
      body: (
         <>
            Incomplete multipart uploads are billed until aborted. Add an
            S3 lifecycle rule to auto-abort uploads older than a few days.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "What's the max file size I can upload to S3?",
      answer:
         "5 GB with a single PutObject; 5 TB with multipart upload. Use multipart for anything over 100 MB.",
   },
   {
      question: "What happens if my upload fails halfway?",
      answer:
         "With single PutObject, you start over. With multipart, only the failed parts retry. S3 Viewer retries failed parts automatically.",
   },
   {
      question: "Do I get charged for failed multipart uploads?",
      answer:
         "Yes — incomplete multipart uploads are stored and billed until aborted. Set a lifecycle rule to auto-abort incomplete uploads after a few days.",
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
            title="How to Upload Large Files to S3 (Multipart)"
            description="Use multipart upload for files over 100 MB. Parts upload in parallel, failed parts retry, and you can resume from where you left off."
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
                  non-resumable — a network blip on a 4 GB upload restarts
                  from zero. Multipart upload (
                  <code>CreateMultipartUpload</code> → many{" "}
                  <code>UploadPart</code> →{" "}
                  <code>CompleteMultipartUpload</code>) splits the file into
                  parts (5 MB minimum, 10,000 max), uploads them in parallel,
                  and lets you retry only the failed parts. It supports up
                  to 5 TB per object. S3 Viewer uses multipart above 100 MB
                  by default with automatic retries.
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
