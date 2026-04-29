import { getRelatedHowTos } from "@/components/HowTo/data";
import HowToPage, {
   type HowToFAQ,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import { buildHowToJsonLd } from "@/components/HowTo/jsonld";
import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { getUseCaseRefs } from "@/components/UseCases/data";
import { SideBySideIllustration } from "@/components/UseCases/illustrations";
import { SITE_URL } from "@/lib/site-config";

const SLUG = "copy-files-between-s3-and-r2";
const TITLE = "How to copy files between AWS S3 and Cloudflare R2";
const KEYWORD = "copy files from S3 to Cloudflare R2";
const TLDR =
   "Cloudflare R2 implements the S3 API, so any S3 client can read from one and write to the other. The naive way is to download the object to your machine and re-upload it — slow, fragile, and bandwidth-expensive. The right way is server-side: stream the bytes directly from the source bucket to the destination. S3 Viewer wraps that in a single right-click; if you're scripting it, use the AWS CLI with `--endpoint-url` against R2 and stream through your own server.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: connect both providers",
      body: (
         <>
            Add your AWS S3 credentials and your Cloudflare R2 token. S3
            Viewer detects each provider from the endpoint and applies
            the right region settings. Both buckets show up in the same
            sidebar.
         </>
      ),
   },
   {
      title: "Right-click the object → Copy or Move",
      body: (
         <>
            Pick the destination bucket on the other provider and confirm
            the new key. S3 Viewer streams the bytes server-side from
            the source to the destination using each provider&apos;s S3
            API. Metadata and tags are preserved by default.
         </>
      ),
   },
   {
      title: "Why CopyObject doesn't work across providers",
      body: (
         <>
            S3&apos;s <code>CopyObject</code> is server-side, but it
            requires source and destination to share an endpoint — by
            design. Cross-provider copies need separate read and write
            operations. S3 Viewer does both on the server, so the bytes
            never touch your local machine.
         </>
      ),
   },
   {
      title: "AWS CLI: use --endpoint-url for R2",
      body: (
         <>
            For scripts, use two AWS profiles — one for AWS, one for R2
            with <code>--endpoint-url</code>. Stream the object through
            a pipe so the bytes don&apos;t persist locally.
         </>
      ),
      code: "aws s3 cp s3://aws-bucket/key.zip - --profile aws |\n  aws s3 cp - s3://r2-bucket/key.zip \\\n    --profile r2 \\\n    --endpoint-url https://<account>.r2.cloudflarestorage.com",
   },
   {
      title: "AWS SDK: stream-to-stream",
      body: (
         <>
            Two clients, one stream. <code>GetObject</code> from the
            source returns a readable body; pipe it into{" "}
            <code>Upload</code> from <code>@aws-sdk/lib-storage</code>{" "}
            against the destination client. Multipart kicks in
            automatically for large files.
         </>
      ),
      code: "import { Upload } from '@aws-sdk/lib-storage';\n\nconst src = await aws.getObject({\n  Bucket: 'aws-bucket', Key: 'key.zip',\n});\nawait new Upload({\n  client: r2,\n  params: {\n    Bucket: 'r2-bucket', Key: 'key.zip', Body: src.Body,\n  },\n}).done();",
   },
   {
      title: "For huge or recurring transfers: rclone",
      body: (
         <>
            For one-time bulk migrations or scheduled syncs across many
            keys, <code>rclone sync</code> is the workhorse. It handles
            multipart, retries, parallelism, and resumes from where it
            left off.
         </>
      ),
      code: "rclone sync aws:my-bucket r2:my-bucket --progress",
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "How do I copy a file from AWS S3 to Cloudflare R2?",
      answer:
         "Easiest in a UI: connect both providers in S3 Viewer, right-click the object, and choose Copy. S3 Viewer streams the bytes server-side from S3 to R2 — no local download, metadata and tags preserved by default. From the AWS CLI: pipe `aws s3 cp` from one profile through to another with `--endpoint-url` set to the R2 endpoint. For bulk migrations: use rclone sync.",
   },
   {
      question: "Can I do a server-side copy across providers?",
      answer:
         "Not with a single CopyObject API call — that requires source and destination to share an endpoint. Cross-provider copies have to read from source and write to destination as two operations. S3 Viewer does this on its server so the bytes don't pass through your local machine; rclone does the equivalent on whichever box you run it on.",
   },
   {
      question: "Does cross-cloud copy in S3 Viewer cost extra?",
      answer:
         "You pay AWS egress on the read from S3 and Cloudflare R2 ingress on the write — and Cloudflare R2 has zero egress fees, which is part of why this pattern is popular. S3 Viewer doesn't charge anything per byte; the streaming happens on our server, but no object data is retained.",
   },
   {
      question: "Will my object's metadata and tags survive the copy?",
      answer:
         "Yes if your tool sets MetadataDirective and TaggingDirective to COPY (or the equivalent on the destination write). The AWS SDK and CLI defaults to REPLACE on these, which silently drops metadata and tags. S3 Viewer sets both to COPY by default, so cache-control headers, content-type, and object tags carry over.",
   },
   {
      question: "What about copying R2 to S3, or S3 to MinIO?",
      answer:
         "Same pattern, any direction — R2 to S3, B2 to MinIO, MinIO to Wasabi. Every S3-compatible provider supports the same Get + Put primitives, and S3 Viewer keeps a separate signer per provider so credentials never cross over.",
   },
   {
      question: "How do I migrate millions of objects from S3 to R2?",
      answer:
         "rclone is the right tool. `rclone sync source:bucket dest:bucket` parallelizes the copy, handles multipart, retries failed parts, and resumes from where it left off. For incremental syncs, run it on a schedule. AWS DataSync is another option for staying inside the AWS ecosystem.",
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
            title="How to Copy Files Between AWS S3 and Cloudflare R2"
            description="Server-side cross-cloud copy from AWS S3 to Cloudflare R2 (or any S3-compatible provider). One-click in S3 Viewer, AWS CLI with --endpoint-url, or rclone sync for bulk."
            canonical={`/how-to/${SLUG}`}
            jsonLd={jsonLd}
         />
         <HowToPage
            eyebrow={TITLE}
            title={TITLE}
            tldr={TLDR}
            visual={<SideBySideIllustration />}
            steps={steps}
            underTheHood={
               <p>
                  S3&apos;s native <code>CopyObject</code> is server-side
                  but requires source and destination to share an
                  endpoint — it doesn&apos;t work across providers.
                  Cross-cloud copies become a Get-then-Put pair: read
                  from source, write to destination. The question is
                  where the bytes live in transit. Local download +
                  re-upload is fine for one file, slow for many. S3
                  Viewer streams source → destination through its own
                  server with metadata and tags preserved by default,
                  so the bytes never touch your machine. For bulk
                  migrations, <code>rclone sync</code> is the standard
                  tool — it parallelizes, retries, and resumes.
               </p>
            }
            faqs={faqs}
            useCases={getUseCaseRefs(["multi-cloud", "cloudflare-r2"])}
            related={getRelatedHowTos([
               "view-s3-and-r2-side-by-side",
               "upload-large-files-to-s3",
               "rename-s3-file",
            ])}
         />
      </>
   );
};

Page.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default Page;
