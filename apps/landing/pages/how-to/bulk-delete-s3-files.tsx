import {
   createHowToPage,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import type { Faq } from "@/lib/types";
import { DeleteIllustration } from "@/components/UseCases/illustrations/how-to/delete";

const SLUG = "bulk-delete-s3-files";
const TLDR =
   "Select the files in S3 Viewer and confirm Delete — this works on AWS S3, R2, B2, MinIO, and other S3-compatible endpoints. Each file must still match the one you reviewed; changed files and uncertain results require fresh review. On versioned AWS buckets, ordinary deletion adds delete markers and keeps prior versions. Unversioned deletion can be permanent.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: tick the checkboxes, then Delete",
      body: (
         <>
            Each row in the file list has a checkbox. The trash button in the
            toolbar is disabled until you tick something; its tooltip then shows
            the count — <strong>Delete 12 selected</strong>. S3 Viewer sends
            batches of up to 1,000 keys, checking each file against the one you
            reviewed, on every connected provider. If some keys fail, the result
            tells you which. Confirmed failures remain available for retry;
            uncertain results require refresh and review and are never
            automatically replayed.
         </>
      ),
   },
   {
      title: "AWS CLI: delete a whole prefix",
      body: (
         <>
            The CLI lists every key under the prefix and deletes them in batches
            of 1,000 under the hood.
         </>
      ),
      code: "aws s3 rm s3://my-bucket/old-logs/ --recursive",
   },
   {
      title: "AWS CLI: delete from a key list",
      body: (
         <>
            For non-contiguous keys, build a JSON delete request and pass it to{" "}
            <code>aws s3api delete-objects</code>.
         </>
      ),
      code: 'aws s3api delete-objects \\\n  --bucket my-bucket \\\n  --delete \'{"Objects":[{"Key":"a.log"},{"Key":"b.log"}]}\'',
   },
   {
      title: "AWS SDK: DeleteObjectsCommand",
      body: (
         <>
            For programmatic bulk delete, use <code>DeleteObjectsCommand</code>{" "}
            in batches of up to 1,000. The response includes any per-key errors,
            so you can retry failures without re-running the whole batch.
         </>
      ),
      code: "const result = await s3.send(\n  new DeleteObjectsCommand({\n    Bucket: 'my-bucket',\n    Delete: {\n      Objects: keys.map((Key) => ({ Key })),\n      Quiet: false,\n    },\n  }),\n);",
   },
   {
      title: "If versioning is on: also delete the versions",
      body: (
         <>
            On a versioned bucket, a normal delete just adds a delete marker. To
            actually purge, list every version and delete each one explicitly
            with its <code>VersionId</code>. S3 Viewer does not purge specific
            versions. On unversioned buckets, deletion can be permanent.
         </>
      ),
      code: "aws s3api list-object-versions \\\n  --bucket my-bucket --prefix old-logs/ \\\n  --query 'Versions[].{Key:Key,VersionId:VersionId}' \\\n  > versions.json",
   },
   {
      title: "Lifecycle rules for ongoing cleanup",
      body: (
         <>
            For predictable cleanup (e.g., delete logs older than 30 days), use
            S3 Lifecycle rules instead of running deletes yourself. Cheap,
            automatic, and survives you forgetting.
         </>
      ),
   },
];

const faqs: Faq[] = [
   {
      question: "How do I bulk-delete files from S3?",
      answer:
         "Select files in S3 Viewer and confirm Delete, on any connected provider. The app checks each reviewed file and reports changes or failures. From the AWS CLI, aws s3 rm s3://bucket/prefix --recursive deletes a prefix; programmatic bulk deletion uses DeleteObjects in batches of up to 1,000.",
   },
   {
      question: "How many objects can I delete in one S3 API call?",
      answer:
         "Up to 1,000 per DeleteObjects request. For more, batch them — most SDKs and tools handle the batching for you. S3 Viewer batches automatically; the AWS CLI's rm --recursive does too.",
   },
   {
      question: "How do I delete all files in an S3 bucket prefix?",
      answer:
         "From the CLI: aws s3 rm s3://bucket/prefix/ --recursive lists every key under the prefix and deletes them in 1,000-key batches. From S3 Viewer: open the ⋮ menu on the folder's row and choose Delete folder — it deletes everything under that prefix recursively, paging through the listing. Programmatically: list with ListObjectsV2 and call DeleteObjects.",
   },
   {
      question: "Why didn't my bulk delete remove my files?",
      answer:
         "Almost always versioning. On a versioned bucket, DeleteObjects writes a delete marker per key — the prior versions are still there (and still billed). Use ListObjectVersions to enumerate every version and DeleteObject with --version-id to fully purge.",
   },
   {
      question: "Can I undo a bulk delete in S3?",
      answer:
         "Only if versioning was enabled when you deleted. Remove the delete markers (or restore the prior versions) to bring objects back. Without versioning, bulk deletes are permanent — there is no recycle bin.",
   },
   {
      question: "Does Cloudflare R2 support bulk delete?",
      answer:
         "Yes. S3 Viewer supports single, bulk, and folder deletion on R2. R2's plain DeleteObject has no delete-time condition, so S3 Viewer checks each object is still the one reviewed with a HEAD request immediately before deleting it, rather than relying on R2 to enforce the condition the way AWS S3 does.",
   },
];

export default createHowToPage({
   slug: SLUG,
   tldr: TLDR,
   seoTitle: "How to Bulk-Delete S3 Files (DeleteObjects API)",
   seoDescription:
      "Three ways to bulk-delete S3 files: AWS CLI rm --recursive, checkbox multi-select in S3 Viewer, or DeleteObjectsCommand — 1,000 keys per request.",
   published: "2026-04-28",
   updated: "2026-10-14",
   visual: <DeleteIllustration />,
   steps,
   underTheHood: (
      <p>
         S3&apos;s <code>DeleteObjects</code> API takes up to 1,000 keys per
         request and returns a per-key result list — successes and failures
         together. For larger deletes you batch by 1,000 and reissue any failed
         keys. The AWS CLI&apos;s <code>rm --recursive</code> handles the
         listing and batching for you under the hood. S3 Viewer supports
         checkbox multi-select and folder deletion on every provider, checking
         each object against its reviewed identity. AWS S3 enforces that check
         as a delete condition; on R2, B2 and other endpoints, S3 Viewer checks
         with a HEAD request immediately before each delete. Missing identities,
         changes, and uncertain results require fresh review. On versioned AWS
         buckets, every &ldquo;delete&rdquo; is really a soft delete (it writes
         a delete marker); to actually purge, you have to enumerate versions and
         delete each one with its <code>VersionId</code>, which S3 Viewer does
         not do. For predictable cleanup, lifecycle rules are the right
         long-term tool.
      </p>
   ),
   faqs,
   useCases: ["s3-browser", "security-and-audit"],
   related: [
      "delete-file-from-s3",
      "rename-s3-file",
      "search-across-s3-buckets",
   ],
});
