import {
   createHowToPage,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import type { Faq } from "@/lib/types";
import { UploadIllustration } from "@/components/UseCases/illustrations/how-to/upload";

const SLUG = "abort-incomplete-multipart-uploads-s3";
const TLDR =
   "A multipart upload that's interrupted — a dropped connection, a crashed script, a cancelled browser tab — leaves its uploaded parts in the bucket even though the object never appears in a normal listing or ListObjectsV2. Those parts are billed as stored data until something aborts the upload or a lifecycle rule cleans them up. S3 Viewer's Incomplete uploads dialog lists every open multipart upload under the current prefix via ListMultipartUploads and aborts one, several, or all of them with AbortMultipartUpload.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: Incomplete uploads, from the bucket toolbar",
      body: (
         <>
            Open the bucket toolbar&apos;s overflow menu and choose{" "}
            <strong>Incomplete uploads</strong>. The dialog lists every open
            multipart upload under the current prefix — key, when it was
            started, and how old it is — paginated with a{" "}
            <strong>Load more</strong> button. Select the ones you want and
            click <strong>Abort selected</strong>, or use{" "}
            <strong>Abort all listed</strong> to clear everything currently
            shown. Failures are reported per upload rather than failing the
            whole batch.
         </>
      ),
   },
   {
      title: "AWS CLI: list them first",
      body: (
         <>
            <code>list-multipart-uploads</code> returns every open upload for
            the bucket (or a prefix, with <code>--prefix</code>), each with its
            own <code>UploadId</code> — the same key can have more than one open
            upload if it was retried.
         </>
      ),
      code: "aws s3api list-multipart-uploads --bucket my-bucket --prefix uploads/",
   },
   {
      title: "AWS CLI: abort one, or loop over all of them",
      body: (
         <>
            Aborting needs both the key and its <code>UploadId</code> — the key
            alone isn&apos;t enough, since there can be more than one open
            upload for it. <code>jq</code> turns the listing into arguments for
            a loop.
         </>
      ),
      code: `aws s3api abort-multipart-upload \\
  --bucket my-bucket --key uploads/video.mp4 --upload-id <id>

# abort everything under a prefix
aws s3api list-multipart-uploads --bucket my-bucket --prefix uploads/ \\
  --query 'Uploads[].[Key,UploadId]' --output text |
while read -r key upload_id; do
  aws s3api abort-multipart-upload --bucket my-bucket --key "$key" --upload-id "$upload_id"
done`,
   },
   {
      title: "Set a lifecycle rule so this doesn't need doing by hand",
      body: (
         <>
            A bucket lifecycle rule with an{" "}
            <code>AbortIncompleteMultipartUpload</code> action (commonly set to
            a few days) cleans these up automatically going forward. That&apos;s
            the right long-term fix; S3 Viewer&apos;s dialog and the CLI
            commands above are for clearing an existing backlog or checking
            there isn&apos;t one.
         </>
      ),
      code: `{
  "Rules": [{
    "ID": "abort-incomplete-multipart",
    "Status": "Enabled",
    "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 3 }
  }]
}`,
   },
   {
      title: "SDK: same two calls, scripted",
      body: (
         <>
            <code>ListMultipartUploadsCommand</code> then{" "}
            <code>AbortMultipartUploadCommand</code> per result — this is
            exactly what S3 Viewer&apos;s route does, at bounded concurrency,
            with <code>NoSuchUpload</code> treated as already-aborted rather
            than a failure.
         </>
      ),
      code: `const { Uploads = [] } = await s3.listMultipartUploads({ Bucket, Prefix });
for (const { Key, UploadId } of Uploads) {
  await s3.abortMultipartUpload({ Bucket, Key, UploadId });
}`,
   },
];

const faqs: Faq[] = [
   {
      question:
         "Why do I have objects in my bill that don't show up in my bucket?",
      answer:
         "They're not objects yet — they're parts of multipart uploads that never completed. A CompleteMultipartUpload call is what turns uploaded parts into a real object; without it, the parts sit in storage, billed, but invisible to ListObjectsV2 and the console's normal listing. list-multipart-uploads (or S3 Viewer's Incomplete uploads dialog) is how you find them.",
   },
   {
      question: "How do I list incomplete multipart uploads in S3?",
      answer:
         "aws s3api list-multipart-uploads --bucket my-bucket, optionally with --prefix to scope it. Each result includes the Key, the UploadId, when it was initiated, and who started it. S3 Viewer's Incomplete uploads dialog shows the same information, paginated, for the current prefix.",
   },
   {
      question: "How do I delete an incomplete multipart upload?",
      answer:
         "You abort it, with both its key and UploadId: aws s3api abort-multipart-upload --bucket my-bucket --key <key> --upload-id <id>. A plain DeleteObject won't touch it, since there's no completed object yet to delete. S3 Viewer's dialog aborts one, several, or every upload currently listed.",
   },
   {
      question: "Does an incomplete multipart upload cost money?",
      answer:
         "Yes — every uploaded part is billed as stored data at the normal rate for as long as it sits there, even though no finished object exists. This is exactly why AbortIncompleteMultipartUpload lifecycle rules and cleanup tools like this exist: a backlog of failed uploads can accumulate real storage cost silently.",
   },
   {
      question:
         "How do I stop incomplete multipart uploads from piling up automatically?",
      answer:
         "Add a bucket lifecycle rule with an AbortIncompleteMultipartUpload action and a DaysAfterInitiation value (a few days is typical). S3 then aborts any multipart upload older than that on its own, so failed or abandoned uploads never accumulate indefinitely.",
   },
   {
      question:
         "Does this work the same on Cloudflare R2, Backblaze B2 and MinIO?",
      answer:
         "Yes. ListMultipartUploads and AbortMultipartUpload are both standard S3 API operations, implemented the same way by R2, B2 and MinIO, so S3 Viewer's Incomplete uploads dialog behaves identically on every connected provider.",
   },
];

export default createHowToPage({
   slug: SLUG,
   tldr: TLDR,
   seoTitle: "Abort Incomplete Multipart Uploads in S3",
   seoDescription:
      "Failed or abandoned multipart uploads leave billed parts behind that ListObjects can't see. List and abort them with the CLI, an SDK, or S3 Viewer.",
   published: "2026-09-07",
   visual: <UploadIllustration />,
   steps,
   underTheHood: (
      <>
         <p>
            A multipart upload exists in a separate namespace from ordinary
            objects for its entire lifetime. <code>UploadPart</code> stores
            bytes against an <code>UploadId</code>, but nothing becomes a real,
            listable object until <code>CompleteMultipartUpload</code> assembles
            the parts. If that last call never happens — connection dropped,
            process crashed, upload cancelled — the parts stay exactly where{" "}
            <code>UploadPart</code> put them, billed as storage, with no
            corresponding key for <code>ListObjectsV2</code> to ever return.
         </p>
         <p>
            <code>ListMultipartUploads</code> is the only way to see this hidden
            namespace: it returns every open upload for the bucket (optionally
            scoped by prefix), each with its own key and <code>UploadId</code> —
            the same key can have several open uploads if it was retried without
            the earlier attempt being cleaned up.{" "}
            <code>AbortMultipartUpload</code> is the only way to remove one, and
            needs both fields; the key alone can&apos;t disambiguate which
            upload to cancel.
         </p>
         <p>
            S3 Viewer&apos;s route pages through{" "}
            <code>ListMultipartUploads</code> the same way object listing pages
            through <code>ListObjectsV2</code>, and aborts a selection at
            bounded concurrency, treating a <code>NoSuchUpload</code> response —
            the upload was already gone, aborted elsewhere or already completed
            — as a success rather than a failure. None of this replaces a
            lifecycle rule for ongoing prevention; it&apos;s for seeing
            what&apos;s accumulated and clearing it.
         </p>
      </>
   ),
   faqs,
   useCases: ["s3-browser", "cloudflare-r2"],
   related: [
      "upload-large-files-to-s3",
      "bulk-delete-s3-files",
      "secure-s3-upload-presigned-urls",
   ],
});
