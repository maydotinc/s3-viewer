import { getRelatedHowTos } from "@/components/HowTo/data";
import {
   createHowToPage,
   type HowToFAQ,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import { getUseCaseRefs } from "@/components/UseCases/data";
import { DeleteIllustration } from "@/components/UseCases/illustrations";

const SLUG = "bulk-delete-s3-files";
const TITLE = "How to bulk-delete S3 files";
const KEYWORD = "bulk delete S3 files";
const TLDR =
   "Use the DeleteObjects API (plural) — up to 1,000 keys per request. From the AWS CLI: `aws s3 rm --recursive` against a prefix. From a tool: tick the checkboxes in S3 Viewer and hit Delete, which sends the selection as one batch. If the bucket has versioning on, each delete only adds a delete marker — you'll need to delete every version explicitly to actually purge.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: tick the checkboxes, then Delete",
      body: (
         <>
            Each row in the file list has a checkbox. The{" "}
            <strong>Delete</strong> button in the toolbar is disabled until you
            tick something, then shows the count — <strong>Delete (12)</strong>.
            S3 Viewer sends the whole selection as one{" "}
            <code>DeleteObjects</code> call — up to 1,000 keys per request, the
            way the API was designed. If some keys fail, the result tells you
            which.
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
            with its <code>VersionId</code>. S3 Viewer is not version-aware — it
            deletes the current version like any other S3 client, so check the
            bucket&apos;s versioning setting yourself before you rely on a
            delete being final.
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

const faqs: HowToFAQ[] = [
   {
      question: "How do I bulk-delete files from S3?",
      answer:
         "Use the DeleteObjects API (plural) — up to 1,000 keys per request. The simplest invocations: `aws s3 rm s3://bucket/prefix --recursive` from the CLI, or tick the checkboxes in S3 Viewer and click Delete. For programmatic deletes, use the SDK's DeleteObjectsCommand in batches of 1,000. The AWS S3 console handles single-key delete; for many keys at once, use the CLI, an SDK, or a tool like S3 Viewer that wraps the bulk API.",
   },
   {
      question: "How many objects can I delete in one S3 API call?",
      answer:
         "Up to 1,000 per DeleteObjects request. For more, batch them — most SDKs and tools handle the batching for you. S3 Viewer batches automatically; the AWS CLI's `rm --recursive` does too.",
   },
   {
      question: "How do I delete all files in an S3 bucket prefix?",
      answer:
         "From the CLI: `aws s3 rm s3://bucket/prefix/ --recursive` lists every key under the prefix and deletes them in 1,000-key batches. From S3 Viewer: open the ⋮ menu on the folder's row and choose Delete folder — it deletes everything under that prefix recursively, paging through the listing. Programmatically: list with ListObjectsV2 and call DeleteObjects.",
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
         "Yes. R2 implements DeleteObjects the same way as AWS S3 — up to 1,000 keys per request. The same CLI commands work with `--endpoint-url` set to R2; checkbox multi-select and Delete in S3 Viewer work against R2 buckets identically.",
   },
];

export default createHowToPage({
   slug: SLUG,
   title: TITLE,
   tldr: TLDR,
   keyword: KEYWORD,
   seoTitle: "How to Bulk-Delete S3 Files (DeleteObjects API)",
   seoDescription:
      "Three ways to bulk-delete S3 files: AWS CLI rm --recursive, checkbox multi-select in S3 Viewer, or DeleteObjectsCommand — 1,000 keys per request.",
   visual: <DeleteIllustration />,
   steps,
   underTheHood: (
      <p>
         S3&apos;s <code>DeleteObjects</code> API takes up to 1,000 keys per
         request and returns a per-key result list — successes and failures
         together. For larger deletes you batch by 1,000 and reissue any failed
         keys. The AWS CLI&apos;s <code>rm --recursive</code> handles the
         listing and batching for you under the hood. S3 Viewer wraps the same
         API in a checkbox multi-select: tick the rows, hit Delete, one round
         trip — and deleting a folder walks the prefix and deletes everything
         under it recursively. On versioned buckets, every &ldquo;delete&rdquo;
         is really a soft delete (it writes a delete marker); to actually purge,
         you have to enumerate versions and delete each one with its{" "}
         <code>VersionId</code>, which S3 Viewer does not do. For predictable
         cleanup, lifecycle rules are the right long-term tool.
      </p>
   ),
   faqs,
   useCases: getUseCaseRefs(["s3-browser", "security-and-audit"]),
   related: getRelatedHowTos([
      "delete-file-from-s3",
      "rename-s3-file",
      "search-across-s3-buckets",
   ]),
});
