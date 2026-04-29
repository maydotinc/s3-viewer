import { getRelatedHowTos } from "@/components/HowTo/data";
import HowToPage, {
   type HowToFAQ,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import { buildHowToJsonLd } from "@/components/HowTo/jsonld";
import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { getUseCaseRefs } from "@/components/UseCases/data";
import { DownloadIllustration } from "@/components/UseCases/illustrations";
import { SITE_URL } from "@/lib/site-config";

const SLUG = "download-file-from-s3";
const TITLE = "How to download a file from S3";
const KEYWORD = "download file from S3";
const TLDR =
   "In a browser, click the file in S3 Viewer and hit download. In a terminal, run aws s3 cp s3://bucket/key ./local-file.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: click the file",
      body: (
         <>
            Hit the download button or press <code>D</code>. The file
            streams from your bucket through your browser via a server-side
            signed URL — your AWS keys never reach the client.
         </>
      ),
   },
   {
      title: "Multiple files: multi-select",
      body: <>Shift-click to select a range. Download as a zip in one click.</>,
   },
   {
      title: "Whole prefix: select the folder",
      body: <>Right-click a prefix and download as zip. Streamed and packaged on the fly.</>,
   },
   {
      title: "CLI alternative: aws s3 cp",
      body: <>For a single file.</>,
      code: "aws s3 cp s3://my-bucket/path/to/file.pdf ./",
   },
   {
      title: "CLI alternative: aws s3 sync",
      body: <>For a whole prefix to a local directory. Skips files you already have.</>,
      code: "aws s3 sync s3://my-bucket/reports/ ./reports/",
   },
   {
      title: "Sharing: presigned URL",
      body: (
         <>
            For someone without AWS access, send a presigned URL — works in
            any browser, expires when you say.
         </>
      ),
      code: "aws s3 presign s3://my-bucket/file.pdf --expires-in 3600",
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "How do I download a file from an S3 bucket?",
      answer:
         "Easiest: open S3 Viewer, click the file, hit download. From the terminal: aws s3 cp s3://bucket/key ./. For someone without AWS access: send them a presigned URL.",
   },
   {
      question: "Can I download an entire S3 folder?",
      answer:
         "Yes. In S3 Viewer, select the prefix and download as zip. From the CLI: aws s3 sync s3://bucket/prefix ./local-dir.",
   },
   {
      question: "How do I download a file from someone else's S3 bucket?",
      answer:
         "If they sent a presigned URL, paste it in any browser. If they invited you to S3 Viewer, sign in and download from the file browser.",
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
            title="How to Download a File From S3"
            description="Three ways to download from S3: the web UI, the AWS CLI (aws s3 cp / sync), and presigned URLs for sharing without AWS access."
            canonical={`/how-to/${SLUG}`}
            jsonLd={jsonLd}
         />
         <HowToPage
            eyebrow={TITLE}
            title={TITLE}
            tldr={TLDR}
            visual={<DownloadIllustration />}
            steps={steps}
            underTheHood={
               <p>
                  A download is a <code>GetObject</code> API call. The CLI
                  streams the body to a local file; S3 Viewer streams it
                  through the browser using a presigned URL signed
                  server-side, so your AWS keys never reach the client.
                  Zip-download for prefixes works by listing keys, streaming
                  each through the server, and packaging on the fly.
               </p>
            }
            faqs={faqs}
            useCases={getUseCaseRefs(["s3-browser"])}
            related={getRelatedHowTos([
               "share-s3-file-with-non-technical-user",
               "upload-large-files-to-s3",
               "search-across-s3-buckets",
            ])}
         />
      </>
   );
};

Page.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default Page;
