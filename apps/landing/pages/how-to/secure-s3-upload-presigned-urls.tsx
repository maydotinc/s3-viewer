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

const SLUG = "secure-s3-upload-presigned-urls";
const TITLE = "How to upload to S3 securely without touching your bucket";
const KEYWORD = "S3 upload without exposing keys";
const TLDR =
   "Never ship AWS access keys to the browser. S3 Viewer keeps the key on the server and streams every upload through its own API into your bucket — the browser only ever talks to S3 Viewer, so there is no CORS rule, no exposed header and no bucket setting to configure. Presigned URLs are the classic alternative for your own apps; S3 Viewer still uses them for downloads, where they need no bucket changes either.";

const steps: HowToStep[] = [
   {
      title: "Why not put the AWS key in the browser?",
      body: (
         <>
            Anything in your browser bundle is public — your access key ends up
            readable to anyone who opens DevTools. Even with scoped IAM, leaking
            the key lets attackers do anything allowed by that IAM policy until
            you rotate. Presigned URLs avoid the problem entirely by signing on
            the server and handing the browser only a short-lived URL.
         </>
      ),
   },
   {
      title: "How S3 Viewer uploads: browser → S3 Viewer → bucket",
      body: (
         <>
            Pick a file and the browser PUTs it to the S3 Viewer API, which
            checks your session and role and streams the bytes straight into the
            bucket with the server&apos;s credential — 25 MB parts, several in
            flight, nothing written to disk. Cancel or lose the connection and
            the half-finished multipart upload is aborted in the bucket. Your
            access key stays encrypted at rest and is decrypted only in memory
            to sign the request.
         </>
      ),
   },
   {
      title: "Nothing to configure on the bucket",
      body: (
         <>
            Because the browser never talks to S3 directly, the bucket needs no
            CORS policy, no exposed <code>ETag</code> header and no
            public-access change. Add a server with a least-privilege key and
            uploads work on AWS S3, Cloudflare R2, MinIO and any other
            S3-compatible provider exactly as they are. Downloads and previews
            still go straight from your bucket to the browser through 15-minute
            presigned links — plain navigations and <code>&lt;img&gt;</code>{" "}
            loads, which need no CORS either.
         </>
      ),
   },
   {
      title: "Background: presigned URLs for your own app",
      body: (
         <>
            If you are building your own uploader, the classic pattern is a
            presigned URL: your backend calls <code>getSignedUrl</code> with{" "}
            <code>PutObjectCommand</code>, the browser PUTs the file to that URL
            and the key never leaves the server. The trade-off is that the
            bucket must then allow your web origin in its CORS policy — which is
            exactly the setup step S3 Viewer avoids by proxying.
         </>
      ),
      code: "import { getSignedUrl } from '@aws-sdk/s3-request-presigner';\nimport { PutObjectCommand } from '@aws-sdk/client-s3';\n\nconst url = await getSignedUrl(\n  s3,\n  new PutObjectCommand({\n    Bucket: 'my-bucket',\n    Key: 'uploads/' + filename,\n    ContentType: contentType,\n  }),\n  { expiresIn: 900 }, // 15 minutes\n);",
   },
   {
      title: "Background: restrict a presigned URL further",
      body: (
         <>
            You can lock down the presigned URL with conditions: specific
            content-type, max size, exact key, expiry, source IP. Adding{" "}
            <code>x-amz-meta-*</code> conditions enforces metadata at upload
            time. The narrower the URL, the less damage if it leaks before
            expiry.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "How do I upload to S3 without exposing my AWS key?",
      answer:
         "Keep the key on a server and let that server do the write. S3 Viewer does exactly this: the browser sends the file to the S3 Viewer API, which streams it into the bucket with the server's credential, so nothing secret reaches the page and the bucket needs no configuration. If you are writing your own app, presigned upload URLs are the standard alternative — the backend signs a short-lived URL and the browser PUTs to it — at the cost of a CORS rule on the bucket.",
   },
   {
      question: "Are presigned URLs secure?",
      answer:
         "They're a bearer token to perform one specific S3 operation, scoped by URL. As long as you keep the expiry short and lock down the conditions (specific key, content-type, max size), they're a strong primitive. The risk is leakage during the validity window — short expiries (15 minutes for upload, 1–24 hours for download) are the standard.",
   },
   {
      question: "Does S3 Viewer need a CORS policy on my bucket?",
      answer:
         "No. Uploads go browser → S3 Viewer → bucket, so the browser never makes a cross-origin request to S3; downloads and previews are plain link and image loads, which browsers allow without CORS. You add the server and start uploading — no bucket settings to change.",
   },
   {
      question: "How large a file can I upload through S3 Viewer?",
      answer:
         "Files are streamed as a multipart upload in 25 MB parts, so the S3 limits apply (10,000 parts, 5 TB per object) rather than the 5 GB single-PUT cap. A self-hosted instance can set MAX_UPLOAD_BYTES to cap uploads; the hosted app sets no limit of its own.",
   },
   {
      question: "Do presigned URLs work with Cloudflare R2?",
      answer:
         "Yes. R2 implements the same S3 presigned URL pattern. Use the same SDK with the R2 endpoint configured (`endpoint: 'https://<account>.r2.cloudflarestorage.com'`); everything else stays the same.",
   },
   {
      question: "How short should a presigned URL's expiry be?",
      answer:
         "As short as the operation reliably finishes. Every link S3 Viewer issues — downloads, previews, Copy link — lasts 15 minutes. In your own app, give upload URLs the same short window and keep long expiries for download links a recipient opens later.",
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
            title="How to Upload to S3 Securely Without Bucket Changes"
            description="How S3 Viewer uploads to AWS S3 and Cloudflare R2 without your key reaching the browser or a single bucket setting changing — plus presigned URLs as background."
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
                  An S3 Viewer upload is one HTTP request from your browser to
                  the S3 Viewer API. The API checks your session and role, then
                  hands the request body to the AWS SDK&apos;s streaming
                  uploader, which cuts it into 25 MB parts and sends four at a
                  time to the bucket while the rest is still arriving. The
                  credential is decrypted in memory only to sign those parts;
                  nothing is written to disk and nothing is retained. If the
                  connection drops, the multipart upload is aborted in the
                  bucket so no orphaned parts are billed. Downloads take the
                  other route: the API signs a 15-minute presigned{" "}
                  <code>GetObject</code> URL and the browser loads it directly
                  from the bucket — a signed query-string version of the request
                  that works once, for one operation, until it expires.
               </p>
            }
            faqs={faqs}
            useCases={getUseCaseRefs(["security-and-audit", "s3-browser"])}
            related={getRelatedHowTos([
               "upload-large-files-to-s3",
               "share-s3-file-with-non-technical-user",
               "download-file-from-s3",
            ])}
         />
      </>
   );
};

Page.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default Page;
