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
const TITLE = "How to upload to S3 securely with presigned URLs";
const KEYWORD = "S3 upload without exposing keys";
const TLDR =
   "Never ship AWS access keys to the browser. The standard pattern is presigned upload URLs: your backend signs a short-lived URL using the access key, the browser uploads directly to S3 with that URL, and the credential never leaves the server. For files over 5 GB (or anything you can't afford to restart), use multipart upload — one presigned URL per part, uploaded in parallel.";

const steps: HowToStep[] = [
   {
      title: "Why not put the AWS key in the browser?",
      body: (
         <>
            Anything in your browser bundle is public — your access key
            ends up readable to anyone who opens DevTools. Even with
            scoped IAM, leaking the key lets attackers do anything
            allowed by that IAM policy until you rotate. Presigned URLs
            avoid the problem entirely by signing on the server and
            handing the browser only a short-lived URL.
         </>
      ),
   },
   {
      title: "Single-file upload: one presigned PUT URL",
      body: (
         <>
            Your backend calls <code>getSignedUrl</code> with{" "}
            <code>PutObjectCommand</code>. The browser receives the URL
            and PUTs the file body directly to S3. The URL expires
            quickly (15 minutes is a good default) and only allows
            writing to the specific key.
         </>
      ),
      code: "import { getSignedUrl } from '@aws-sdk/s3-request-presigner';\nimport { PutObjectCommand } from '@aws-sdk/client-s3';\n\nconst url = await getSignedUrl(\n  s3,\n  new PutObjectCommand({\n    Bucket: 'my-bucket',\n    Key: 'uploads/' + filename,\n    ContentType: contentType,\n  }),\n  { expiresIn: 900 }, // 15 minutes\n);",
   },
   {
      title: "Browser PUT with the URL",
      body: (
         <>
            From the client, <code>fetch(url, &#123; method: 'PUT', body: file &#125;)</code>. No
            access key in the page; no proxy through your server; the
            file bytes go browser → S3 directly. Pair with{" "}
            <code>ContentType</code> headers so the object lands with the
            right type for downloads later.
         </>
      ),
   },
   {
      title: "Large files: multipart with presigned per-part URLs",
      body: (
         <>
            Above ~100 MB, switch to multipart upload. Your backend
            calls <code>CreateMultipartUpload</code>, signs a presigned
            URL per part, and returns them to the client. The browser
            PUTs each part in parallel, collects ETags, and posts them
            back; your backend completes the upload. Failed parts
            retry independently.
         </>
      ),
   },
   {
      title: "How S3 Viewer's upload uses this pattern",
      body: (
         <>
            When you drop a file into S3 Viewer above 50 MB, the API
            calls <code>CreateMultipartUpload</code> and signs a
            presigned URL for each 25 MB part. The browser uploads
            parts directly to S3 in parallel via those URLs — your
            access key, encrypted at rest with RSA-4096 (PKCS1_OAEP,
            SHA-256) server-side, never travels.
         </>
      ),
   },
   {
      title: "Restrict the presigned URL further",
      body: (
         <>
            You can lock down the presigned URL with conditions:
            specific content-type, max size, exact key, expiry, source
            IP. Adding <code>x-amz-meta-*</code> conditions enforces
            metadata at upload time. The narrower the URL, the less
            damage if it leaks before expiry.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "How do I upload to S3 without exposing my AWS key?",
      answer:
         "Use presigned upload URLs. Your backend signs a short-lived URL with your AWS access key (server-side, behind your auth), the browser uploads directly to S3 with that URL, and your credential never enters the page. The URL expires after the duration you set (typically 15 minutes); even if it leaks, the blast radius is one specific key for a few minutes.",
   },
   {
      question: "Are presigned URLs secure?",
      answer:
         "They're a bearer token to perform one specific S3 operation, scoped by URL. As long as you keep the expiry short and lock down the conditions (specific key, content-type, max size), they're a strong primitive. The risk is leakage during the validity window — short expiries (15 minutes for upload, 1–24 hours for download) are the standard.",
   },
   {
      question: "Can I use presigned URLs for large file uploads?",
      answer:
         "Yes, with multipart upload. Your backend issues one presigned URL per part (5 MB minimum, 10,000 parts max, 5 TB ceiling), the browser uploads parts in parallel directly to S3, and your backend calls CompleteMultipartUpload at the end. S3 Viewer uses this pattern automatically above 50 MB.",
   },
   {
      question: "What's the maximum size of a presigned upload?",
      answer:
         "5 GB for a single PutObject presigned URL. For larger files, use multipart upload — one presigned URL per part, up to 10,000 parts × 5 GB = 5 TB per object.",
   },
   {
      question: "Do presigned URLs work with Cloudflare R2?",
      answer:
         "Yes. R2 implements the same S3 presigned URL pattern. Use the same SDK with the R2 endpoint configured (`endpoint: 'https://<account>.r2.cloudflarestorage.com'`); everything else stays the same.",
   },
   {
      question: "How short should the expiry be?",
      answer:
         "As short as your upload reliably finishes. 15 minutes is a good default for browser uploads. For multipart, give each part-URL the same short expiry — the browser uploads parts quickly enough that 15 minutes covers it. Long expiries are mostly for download links, where the recipient opens it later.",
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
            title="How to Upload to S3 Securely With Presigned URLs"
            description="The secure pattern for browser uploads to AWS S3 and Cloudflare R2: server-signed presigned URLs that let the browser PUT directly without ever seeing your AWS key."
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
                  A presigned URL is a signed query-string version of an
                  S3 request. The signature is computed on the server
                  using your AWS access key, then the URL is handed to
                  the browser — which can use it once, before it
                  expires, for the exact operation it was signed for.
                  For uploads, you sign a <code>PutObjectCommand</code>;
                  for multipart, you sign one URL per part. The browser
                  PUTs the bytes directly to S3, so the data path is
                  browser → S3 with no proxy and no credential exposure.
                  S3 Viewer&apos;s own upload UI uses this exact
                  pattern: presigned per-part URLs above 50 MB, your
                  encrypted credential signing them server-side, your
                  browser never seeing the key.
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
