import {
   createHowToPage,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import type { Faq } from "@/lib/types";
import { UploadIllustration } from "@/components/UseCases/illustrations/how-to/upload";

const SLUG = "secure-s3-upload-presigned-urls";
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
            Smaller files use a single upload request to the S3 Viewer API. For
            larger files, the browser coordinates a multipart upload with
            separate requests to the API for each part. Both paths check your
            session and role and stream the bytes into the bucket using the
            server&apos;s credential, without writing object contents to disk.
            Interrupted multipart uploads can be resumed; cancellation requests
            cleanup on a best-effort basis. Your access key stays encrypted at
            rest and is decrypted only in memory to sign requests.
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
            S3-compatible provider exactly as they are. Individual downloads and
            media previews go from your bucket to the browser through 15-minute
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

const faqs: Faq[] = [
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
         "No. Uploads go browser → S3 Viewer → bucket, so the browser does not send uploads directly to S3. Individual downloads and media previews use link and image loads, which browsers allow without CORS. Archive downloads and text editing go through the API. No bucket CORS changes are needed for these operations.",
   },
   {
      question: "How large a file can I upload through S3 Viewer?",
      answer:
         "The upload limit depends on the instance's configuration and the storage provider. Operators can set MAX_UPLOAD_BYTES, and the application's multipart planning and object-size limits also apply. Your provider may impose a lower limit. Check with your instance's operator for its configured limit.",
   },
   {
      question: "Do presigned URLs work with Cloudflare R2?",
      answer:
         "Yes. R2 implements the same S3 presigned URL pattern. Use the same SDK with the R2 endpoint configured (endpoint: 'https://<account>.r2.cloudflarestorage.com'); everything else stays the same.",
   },
   {
      question: "How short should a presigned URL's expiry be?",
      answer:
         "Choose a short window that gives the recipient time to start the request. S3 Viewer's individual-object presigned download, preview, and Copy link URLs expire after 15 minutes; archive download tokens expire after 5 minutes. Credentials or bucket policies can end access sooner.",
   },
];

export default createHowToPage({
   slug: SLUG,
   heading: "How to upload to S3 securely without touching your bucket",
   tldr: TLDR,
   seoTitle: "Upload to S3 Securely Without Bucket Changes",
   seoDescription:
      "How S3 Viewer uploads to AWS S3 and Cloudflare R2 without your key reaching the browser or a single bucket setting changing — plus presigned URLs as background.",
   published: "2026-04-28",
   updated: "2026-10-12",
   visual: <UploadIllustration />,
   steps,
   underTheHood: (
      <p>
         Smaller files arrive at the S3 Viewer API in a single request, whose
         body the API passes to the AWS SDK&apos;s streaming uploader. Larger
         files use browser-coordinated multipart uploads: the browser starts the
         upload, sends parts in separate requests through the API, and requests
         completion. It can retry individual parts and resume an interrupted
         upload while the uploaded parts remain available. Both paths enforce
         session and role checks, decrypt credentials only in memory, and avoid
         storing object contents on disk. Failed single-request uploads and
         cancelled multipart uploads trigger best-effort cleanup; incomplete
         parts can remain and incur storage charges, so a bucket lifecycle rule
         is a useful backstop. Individual-object downloads take the other route:
         the API signs a 15-minute presigned <code>GetObject</code> URL and the
         browser loads it directly from the bucket. The URL allows repeated GET
         requests for that object until it expires, subject to credential
         validity and bucket permissions.
      </p>
   ),
   faqs,
   useCases: ["security-and-audit", "s3-browser"],
   related: [
      "upload-large-files-to-s3",
      "share-s3-file-with-non-technical-user",
      "download-file-from-s3",
   ],
});
