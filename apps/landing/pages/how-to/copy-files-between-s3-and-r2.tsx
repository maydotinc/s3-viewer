import {
   createHowToPage,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import type { Faq } from "@/lib/types";
import { SideBySideIllustration } from "@/components/UseCases/illustrations/how-to/side-by-side";

const SLUG = "copy-files-between-s3-and-r2";
const TLDR =
   "S3's CopyObject requires the source and destination to share an endpoint, so a cross-provider copy has always meant reading from one and writing to the other. S3 Viewer now does that loop for you: add both as servers, then use “Copy to another bucket…” on a file, a folder, or a selection — it copies server-side when the destination is on the same server, or streams the bytes through S3 Viewer's own server when the destination is a different connected server, S3 to R2 included. For a one-off file or a modest folder that's now the easiest path. For a large or repeated migration — millions of objects, a scheduled sync — rclone or the AWS CLI still do it better.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: “Copy to another bucket…”",
      body: (
         <>
            Add both providers as servers, then open the source file or
            folder&apos;s ⋮ menu (or select several rows and use the selection
            toolbar) and choose <strong>Copy to another bucket…</strong>. Pick
            the destination server, its bucket, and a destination prefix,
            optionally check{" "}
            <strong>Replace objects that already exist there</strong>, and run
            it. A folder is relisted and copied object by object with progress,
            and the transfer is resumable and cancellable like a folder move.
         </>
      ),
   },
   {
      title: "What actually moves the bytes",
      body: (
         <>
            If the destination is on the <strong>same server</strong> — a
            different bucket on the same AWS or R2 account, for example — S3
            Viewer issues a server-side <code>CopyObject</code>; nothing passes
            through your browser or S3 Viewer&apos;s own server. If the
            destination is a <strong>different connected server</strong>,
            including a different provider, there is no server-side call that
            can do that, so S3 Viewer reads the object from the source and
            writes it to the destination through its own server, carrying over
            content type, cache headers and metadata.
         </>
      ),
   },
   {
      title: "For a large or repeated migration, use rclone instead",
      body: (
         <>
            S3 Viewer&apos;s transfer runs one object (or one folder&apos;s
            objects, sequentially with light concurrency) through a single
            process. For moving millions of objects, or syncing on a schedule,{" "}
            <code>rclone</code> is still the right tool — it parallelizes
            aggressively, resumes, and is built for exactly that.{" "}
            <code>rclone config</code> walks you through the two remotes, or
            write them by hand; R2 takes <code>provider = Cloudflare</code>,{" "}
            <code>region = auto</code>, and your account endpoint.
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
      title: "Run the rclone transfer",
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
      title: "One-off file from a terminal: the AWS CLI",
      body: (
         <>
            If you&apos;d rather stay in a terminal for a single object, two
            profiles and a pipe do it — one for AWS, one for R2 with{" "}
            <code>--endpoint-url</code>. The bytes stream through your machine,
            same as S3 Viewer&apos;s server-side stream does through its server.
         </>
      ),
      code: "aws s3 cp s3://aws-bucket/key.zip - --profile aws |\n  aws s3 cp - s3://r2-bucket/key.zip \\\n    --profile r2 \\\n    --endpoint-url https://<account>.r2.cloudflarestorage.com",
   },
   {
      title: "Verify in S3 Viewer",
      body: (
         <>
            Switch to the destination server in the sidebar and open the
            destination prefix. Object counts and sizes should match the source;
            open a couple of files to check their content type and preview them,
            whichever tool did the transfer.
         </>
      ),
   },
];

const faqs: Faq[] = [
   {
      question: "How do I copy a file from AWS S3 to Cloudflare R2?",
      answer:
         "Easiest: add both as servers in S3 Viewer and use “Copy to another bucket…” on the file or folder — it streams the bytes through S3 Viewer's server since S3 and R2 don't share an endpoint. For a large or repeated migration, rclone is still the better tool: configure an aws remote and an r2 remote (both the s3 backend, R2 with provider = Cloudflare, region = auto and your account endpoint), then run rclone sync aws:bucket r2:bucket.",
   },
   {
      question: "Can I do a server-side copy across providers?",
      answer:
         "No. A single CopyObject call requires the source and destination to share an endpoint, and no S3-compatible provider offers a cross-endpoint copy. A cross-provider transfer is always a read from one and a write to the other. S3 Viewer now automates that loop for you — it streams the object through its own server when you copy between two different connected servers — and rclone or the AWS CLI do the same loop from whichever machine you run them on.",
   },
   {
      question: "Does S3 Viewer copy files between S3 and R2?",
      answer:
         "Yes. Add an S3 server and an R2 server, then use “Copy to another bucket…” on a file row, a folder row, or a selection. Within one server it's a true server-side CopyObject; across two different servers — S3 to R2 or any other pairing — S3 Viewer streams the object through its own server, carrying content type, cache headers and metadata, and lets you replace an existing object or skip it. It runs one object (or one folder's worth) at a time with light concurrency, so for a handful of files or an occasional folder it's the simplest option; for a large or ongoing migration, rclone is still faster and more resumable.",
   },
   {
      question: "Will my object's metadata and tags survive the copy?",
      answer:
         "Within one provider, CopyObject defaults MetadataDirective and TaggingDirective to COPY, so metadata and tags carry over unless you pass REPLACE — and S3 Viewer's same-server transfer uses exactly that. Across providers, S3 Viewer's stream carries content type, cache/disposition/language headers and user metadata, but not tags: R2 has no object tagging API, so tags never survive a transfer into R2 regardless of which tool performs it. rclone's --metadata flag preserves user metadata the same way.",
   },
   {
      question: "What about copying R2 to S3, or S3 to MinIO?",
      answer:
         "Same pattern, any direction — R2 to S3, B2 to MinIO, MinIO to Wasabi. S3 Viewer's “Copy to another bucket…” works between any two servers you've connected, regardless of which providers they are. Every S3-compatible provider also supports the Get and Put primitives rclone needs, so only the endpoint and provider string in its remote config change.",
   },
   {
      question: "How do I migrate millions of objects from S3 to R2?",
      answer:
         "rclone sync, run from a machine with good bandwidth to both — ideally an EC2 instance in the source region to avoid paying egress twice. It parallelizes, handles multipart, retries failures and resumes where it stopped, so you can run it repeatedly until the diff is empty and then keep it on a schedule for incremental syncs. S3 Viewer's built-in transfer is for a file, a folder, or a selection, not a bulk migration tool — it isn't the right choice at that scale. Cloudflare's Super Slurper is also worth a look for one-shot migrations into R2.",
   },
   {
      question: "What does the transfer cost?",
      answer:
         "You pay AWS egress on every byte read out of S3, plus request charges on both sides, whether the read happens on your machine, an EC2 instance, or S3 Viewer's server. Cloudflare R2 charges no egress fee, which is a large part of why this migration is common in the first place. Running rclone (or S3 Viewer) inside AWS in the same region as the source bucket avoids a second hop.",
   },
];

export default createHowToPage({
   slug: SLUG,
   tldr: TLDR,
   seoTitle: "Copy Files Between AWS S3 and Cloudflare R2",
   seoDescription:
      "Copy objects from AWS S3 to Cloudflare R2 in-app with S3 Viewer's Copy to another bucket…, or with rclone sync and the AWS CLI for large migrations.",
   published: "2026-04-28",
   visual: <SideBySideIllustration />,
   steps,
   underTheHood: (
      <p>
         S3&apos;s native <code>CopyObject</code> is server-side but requires
         the source and destination to share an endpoint, so it cannot cross
         providers. Every cross-cloud copy is therefore a <code>GetObject</code>{" "}
         followed by a <code>PutObject</code> (or a multipart upload), and the
         only real question is which machine the bytes pass through.{" "}
         <code>rclone</code> runs that read-and-write loop with configurable
         parallelism, splits large objects into parts, retries what fails, and
         resumes where it stopped — still the right choice for a large or
         repeated migration. S3 Viewer now runs the same loop itself for a
         single file, folder, or selection: “Copy to another bucket…” does a
         server-side <code>CopyObject</code> when the destination is on the same
         server, and a streamed <code>GetObject</code> → <code>PutObject</code>
         /multipart upload through S3 Viewer&apos;s own server when it
         isn&apos;t, reusing the same streaming upload path, admission limits
         and idle-timeout handling regular uploads use. It is deliberately not a
         bulk sync tool — no scheduling, no diffing a whole bucket — just a
         click for the file or folder in front of you, with the same file
         browser giving you both sides to check before and after.
      </p>
   ),
   faqs,
   useCases: ["multi-cloud", "cloudflare-r2"],
   related: [
      "view-s3-and-r2-side-by-side",
      "upload-large-files-to-s3",
      "rename-s3-file",
   ],
});
