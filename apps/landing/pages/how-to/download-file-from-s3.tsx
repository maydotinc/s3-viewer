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
   "Three patterns. Click it in S3 Viewer (a 15-minute presigned URL is signed server-side; your AWS keys never reach the browser, and the filename and extension are inferred from ContentType). Run `aws s3 cp s3://bucket/key ./` from a terminal. Or send a presigned URL to anyone who doesn't have AWS access.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: click the file",
      body: (
         <>
            Hit the download button. The file streams from your bucket
            through your browser via a short-lived (15 minute) presigned
            URL signed server-side using your encrypted credentials —
            your AWS keys never reach the client. The filename and
            extension are inferred from the object&apos;s ContentType
            header, so the file lands on disk with the right name even
            if the key was a raw UUID.
         </>
      ),
   },
   {
      title: "Multi-select to grab several at once",
      body: (
         <>
            Shift-click a range and download — same UX as a desktop file
            manager.
         </>
      ),
   },
   {
      title: "AWS CLI: aws s3 cp (single file)",
      body: <>For one file. Streams directly to disk.</>,
      code: "aws s3 cp s3://my-bucket/path/to/file.pdf ./",
   },
   {
      title: "AWS CLI: aws s3 sync (whole prefix)",
      body: (
         <>
            Mirrors a prefix to a local directory and skips files you
            already have. The right pattern for backups or local
            development.
         </>
      ),
      code: "aws s3 sync s3://my-bucket/reports/ ./reports/",
   },
   {
      title: "AWS SDK: GetObject",
      body: (
         <>
            For a backend, stream the response body to a file or to a
            response stream.
         </>
      ),
      code: "const obj = await s3.getObject({\n  Bucket: 'my-bucket',\n  Key: 'file.pdf',\n});\nawait pipeline(obj.Body, fs.createWriteStream('./file.pdf'));",
   },
   {
      title: "Sharing: presigned URL for someone without AWS",
      body: (
         <>
            Right-click → Share link in S3 Viewer, or run{" "}
            <code>aws s3 presign</code>. Same primitive — works in any
            browser, expires when you say. Treat it as a bearer token.
         </>
      ),
      code: "aws s3 presign s3://my-bucket/file.pdf --expires-in 3600",
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "How do I download a file from an S3 bucket?",
      answer:
         "Easiest: open S3 Viewer in a browser, click the file, hit download — it streams via a server-side presigned URL with the correct filename and extension inferred from the ContentType header. From a terminal: `aws s3 cp s3://bucket/key ./`. From an SDK: call GetObject and pipe the response body to a file. To share with someone who doesn't have AWS access: generate a presigned URL with `aws s3 presign` or right-click → Share link in S3 Viewer.",
   },
   {
      question: "How do I download an entire S3 prefix or folder?",
      answer:
         "From the AWS CLI: `aws s3 sync s3://bucket/prefix ./local-dir` — it mirrors the prefix and skips files already on disk. Programmatically: list the prefix with ListObjectsV2 and GetObject each key in parallel.",
   },
   {
      question: "How do I download a file from someone else's S3 bucket?",
      answer:
         "If they sent you a presigned URL, paste it in any browser — it works without an AWS account until it expires. If they invited you to S3 Viewer, sign in and download from the file browser. If they granted your AWS account cross-account access, use your own AWS CLI as normal.",
   },
   {
      question: "Why do my AWS keys never reach the client in S3 Viewer?",
      answer:
         "S3 Viewer signs every request server-side using your encrypted credentials, then issues a short-lived presigned URL the browser fetches. Your access key and secret stay encrypted on the server (RSA-4096 at rest); only a 15-minute signed URL ever reaches the client. Even if someone intercepts the URL, it expires fast and only grants that one operation.",
   },
   {
      question: "Can I download from Cloudflare R2 the same way?",
      answer:
         "Yes. R2 implements the S3 GetObject API and presigned URLs. The AWS CLI works against R2 with `--endpoint-url`; S3 Viewer's download flow is identical for R2 and AWS S3.",
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
            title="How to Download a File From S3 (Browser, CLI, Presigned URL)"
            description="Three ways to download from S3 — browser via S3 Viewer, AWS CLI, or presigned URL. S3 Viewer signs server-side so your keys never reach the client."
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
                  A download is a <code>GetObject</code> API call. The
                  CLI streams the response body to a local file; SDKs
                  return a readable stream you pipe wherever you want;
                  S3 Viewer signs a short-lived presigned URL server-side
                  using your encrypted credentials, infers the filename
                  and extension from the ContentType header, and the
                  browser fetches that URL — so your AWS keys never
                  reach the client. Sharing with a non-AWS user is the
                  same primitive: a presigned URL is just a signed
                  query-string version of GetObject anyone with the link
                  can fetch until it expires.
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
