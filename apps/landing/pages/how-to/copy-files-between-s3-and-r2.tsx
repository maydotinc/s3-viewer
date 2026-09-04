import {
   createHowToPage,
   type HowToFAQ,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import { getRelatedHowTos } from "@/components/HowTo/data";
import { getUseCaseRefs } from "@/components/UseCases/data";
import { SideBySideIllustration } from "@/components/UseCases/illustrations";

const SLUG = "copy-files-between-s3-and-r2";
const TITLE = "How to copy files between AWS S3 and Cloudflare R2";
const KEYWORD = "copy files from S3 to Cloudflare R2";
const TLDR =
   "There is no single API call for this: S3's CopyObject requires the source and destination to share an endpoint, so a cross-provider copy is always a read followed by a write. rclone is the tool for it — `rclone sync` handles multipart, parallelism, retries and resume. The AWS CLI works too, one file at a time, with `--endpoint-url` pointed at R2. S3 Viewer isn't the mover here; use it to browse both buckets, confirm what you're about to transfer, and verify the result afterwards.";

const steps: HowToStep[] = [
   {
      title: "Check what you're moving",
      body: (
         <>
            Add both providers as servers in S3 Viewer and open the source
            prefix. Filter the folder, check the sizes and modified dates in the
            listing (open an object for its content type, storage class and
            ETag), and confirm the destination bucket is empty (or that you are
            happy to merge into it) before you start.
         </>
      ),
   },
   {
      title: "Configure rclone remotes",
      body: (
         <>
            <code>rclone config</code> walks you through it, or write the two
            remotes by hand. Both use the <code>s3</code> backend; R2 takes{" "}
            <code>provider = Cloudflare</code>, <code>region = auto</code>, and
            your account endpoint.
         </>
      ),
      code: "# ~/.config/rclone/rclone.conf\n[aws]\ntype = s3\nprovider = AWS\nregion = us-east-1\naccess_key_id = ...\nsecret_access_key = ...\n\n[r2]\ntype = s3\nprovider = Cloudflare\nregion = auto\naccess_key_id = ...\nsecret_access_key = ...\nendpoint = https://<account>.r2.cloudflarestorage.com",
   },
   {
      title: "Dry-run the sync",
      body: (
         <>
            <code>--dry-run</code> prints exactly what would be transferred
            without writing anything. Worth doing every time, especially before
            a sync that could delete on the destination.
         </>
      ),
      code: "rclone sync aws:my-bucket r2:my-bucket --dry-run",
   },
   {
      title: "Run the transfer",
      body: (
         <>
            <code>rclone sync</code> parallelizes, uses multipart for large
            objects, retries failed transfers, and resumes if you stop it. Raise{" "}
            <code>--transfers</code> if you have the bandwidth;{" "}
            <code>copy</code> instead of <code>sync</code> if you never want
            anything deleted on the destination.
         </>
      ),
      code: "rclone sync aws:my-bucket r2:my-bucket \\\n  --transfers 16 --checkers 32 --progress",
   },
   {
      title: "One-off file: the AWS CLI",
      body: (
         <>
            For a single object, two profiles and a pipe are enough — one for
            AWS, one for R2 with <code>--endpoint-url</code>. The bytes stream
            through your machine, which is fine for one file and slow for
            thousands.
         </>
      ),
      code: "aws s3 cp s3://aws-bucket/key.zip - --profile aws |\n  aws s3 cp - s3://r2-bucket/key.zip \\\n    --profile r2 \\\n    --endpoint-url https://<account>.r2.cloudflarestorage.com",
   },
   {
      title: "Verify in S3 Viewer",
      body: (
         <>
            Switch to the R2 server in the sidebar and open the destination
            prefix. Object counts and sizes should match the source; open a
            couple of files to check their content type and preview them.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "How do I copy a file from AWS S3 to Cloudflare R2?",
      answer:
         "Use rclone: configure an `aws` remote and an `r2` remote (both the s3 backend, R2 with provider = Cloudflare, region = auto and your account endpoint), then run `rclone sync aws:bucket r2:bucket`. For a single file, pipe `aws s3 cp` from one profile into another with `--endpoint-url` set to R2. S3 Viewer doesn't do the transfer — use it to browse both buckets and verify the result.",
   },
   {
      question: "Can I do a server-side copy across providers?",
      answer:
         "No. A single CopyObject call requires the source and destination to share an endpoint, so a cross-provider copy is always a read from one and a write to the other. rclone does that on whichever machine you run it on; a hosted tool that offered it would have to proxy your object bytes.",
   },
   {
      question: "Does S3 Viewer copy files between S3 and R2?",
      answer:
         "No, and deliberately. S3 Viewer streams uploads through its server into your bucket without keeping them, and downloads go straight from your bucket to your browser via short-lived links. Cross-cloud transfers belong to rclone or the AWS CLI; S3 Viewer is how you inspect both sides before and after.",
   },
   {
      question: "Will my object's metadata and tags survive the copy?",
      answer:
         "Within one provider, CopyObject defaults MetadataDirective and TaggingDirective to COPY, so metadata and tags carry over unless you pass REPLACE. Across providers you are doing a fresh PUT, so it depends on your tool: rclone carries content-type and modification time, and `--metadata` preserves user metadata. R2 does not implement object tagging, so tags will not survive a transfer into R2.",
   },
   {
      question: "What about copying R2 to S3, or S3 to MinIO?",
      answer:
         "Same pattern, any direction — R2 to S3, B2 to MinIO, MinIO to Wasabi. Every S3-compatible provider supports the Get and Put primitives rclone needs; only the endpoint and provider string in the remote change.",
   },
   {
      question: "How do I migrate millions of objects from S3 to R2?",
      answer:
         "rclone sync, run from a machine with good bandwidth to both — ideally an EC2 instance in the source region to avoid paying egress twice. It parallelizes, handles multipart, retries failures and resumes where it stopped, so you can run it repeatedly until the diff is empty and then keep it on a schedule for incremental syncs. Cloudflare's Super Slurper is worth a look for one-shot migrations into R2.",
   },
   {
      question: "What does the transfer cost?",
      answer:
         "You pay AWS egress on every byte read out of S3, plus request charges on both sides. Cloudflare R2 charges no egress fee, which is a large part of why this migration is common in the first place. Running rclone inside AWS in the same region as the source bucket avoids a second hop.",
   },
];

export default createHowToPage({
   slug: SLUG,
   title: TITLE,
   tldr: TLDR,
   keyword: KEYWORD,
   seoTitle: "How to Copy Files Between AWS S3 and Cloudflare R2",
   seoDescription:
      "Move objects from AWS S3 to Cloudflare R2 with rclone sync or the AWS CLI, and use S3 Viewer to browse and verify both buckets before and after.",
   visual: <SideBySideIllustration />,
   steps,
   underTheHood: (
      <p>
         S3&apos;s native <code>CopyObject</code> is server-side but requires
         the source and destination to share an endpoint, so it cannot cross
         providers. Every cross-cloud copy is therefore a <code>GetObject</code>{" "}
         followed by a <code>PutObject</code> (or a multipart upload), and the
         only real question is which machine the bytes pass through.{" "}
         <code>rclone</code> is the standard answer: it runs the read-and-write
         loop with configurable parallelism, splits large objects into parts,
         retries what fails, and resumes where it stopped. S3 Viewer stays out
         of that path on purpose — object bytes never flow through our servers,
         so there is nowhere for a cross-provider copy to happen. What it gives
         you instead is the same file browser over both buckets, which is what
         you actually want when you are deciding what to move and checking that
         it arrived.
      </p>
   ),
   faqs,
   useCases: getUseCaseRefs(["multi-cloud", "cloudflare-r2"]),
   related: getRelatedHowTos([
      "view-s3-and-r2-side-by-side",
      "upload-large-files-to-s3",
      "rename-s3-file",
   ]),
});
