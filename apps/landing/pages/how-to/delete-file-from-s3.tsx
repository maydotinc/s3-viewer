import {
   createHowToPage,
   type HowToFAQ,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import { getRelatedHowTos } from "@/components/HowTo/data";
import { getUseCaseRefs } from "@/components/UseCases/data";
import { DeleteIllustration } from "@/components/UseCases/illustrations";

const SLUG = "delete-file-from-s3";
const TITLE = "How to delete a file from S3 safely";
const KEYWORD = "delete file from S3";
const TLDR =
   "Run `aws s3 rm s3://bucket/key`, or open the ⋮ menu on the row in S3 Viewer and choose Delete. The catch: if the bucket has versioning enabled, this only adds a delete marker — the prior version is still there and still billed. To actually purge a versioned object, delete each version explicitly with its version ID. For several objects at once, tick the checkboxes in S3 Viewer and hit Delete: the selection goes out as one DeleteObjects call. If MFA Delete is enabled, you'll need an MFA token.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: ⋮ → Delete",
      body: (
         <>
            Open the ⋮ menu on the object&apos;s row and choose{" "}
            <strong>Delete</strong>. To clear several at once, tick their
            checkboxes and use the <strong>Delete</strong> button in the toolbar
            — the selection goes out as a single <code>DeleteObjects</code> call
            (the S3 API takes up to 1,000 keys per request). The confirmation
            shows how many objects you are about to delete.
         </>
      ),
   },
   {
      title: "AWS CLI: aws s3 rm",
      body: <>Single file or whole prefix.</>,
      code: "aws s3 rm s3://my-bucket/old-file.zip\naws s3 rm s3://my-bucket/old-prefix/ --recursive",
   },
   {
      title: "Check if versioning is on first",
      body: (
         <>
            On a versioned bucket, <code>aws s3 rm</code> only adds a delete
            marker — the prior version is still there and still billed. Check
            before you delete.
         </>
      ),
      code: "aws s3api get-bucket-versioning --bucket my-bucket",
   },
   {
      title: "List all versions if you're not sure",
      body: <>Lists every version and delete marker for a key or prefix.</>,
      code: "aws s3api list-object-versions \\\n  --bucket my-bucket --prefix old-file.zip",
   },
   {
      title: "Permanently delete: remove each version",
      body: (
         <>
            Delete each version explicitly with its version ID. The delete
            marker is itself a version — delete that too if you want to fully
            erase the key.
         </>
      ),
      code: "aws s3api delete-object \\\n  --bucket my-bucket --key old-file.zip \\\n  --version-id <version-id>",
   },
   {
      title: "Watch out for MFA Delete",
      body: (
         <>
            If MFA Delete is enabled on the bucket, deleting any version
            requires the bucket owner&apos;s MFA token. Plan accordingly — this
            is on by design for compliance buckets.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "How do I delete a file from S3?",
      answer:
         "From the AWS CLI: `aws s3 rm s3://bucket/key`. From a tool: open the ⋮ menu on the row in S3 Viewer and choose Delete, or tick several checkboxes and use the Delete button to send them as one DeleteObjects call. For prefixes from the CLI: `aws s3 rm s3://bucket/prefix --recursive`. If the bucket has versioning enabled, this only adds a delete marker — see below for permanent deletion.",
   },
   {
      question: "Why does my deleted S3 file still appear?",
      answer:
         "Almost always versioning. On a versioned bucket, `aws s3 rm` adds a delete marker rather than purging the object — the prior versions are still there (and still billed). To fully remove the file, delete the specific version IDs with `aws s3api delete-object --version-id`.",
   },
   {
      question: "Can I undo a delete in S3?",
      answer:
         "Only if versioning was enabled when you deleted. Remove the delete marker (or restore the prior version) to bring the object back. Without versioning, S3 deletes are permanent — there is no recycle bin.",
   },
   {
      question: "How do I delete an entire S3 folder?",
      answer:
         "From the CLI: `aws s3 rm s3://bucket/prefix/ --recursive` lists every key under the prefix and deletes them. From S3 Viewer: open the ⋮ menu on the folder's row and choose Delete folder, which walks the prefix and deletes everything under it. Remember S3 has no folders — you're deleting every key sharing that prefix.",
   },
   {
      question: "How do I bulk-delete multiple S3 files?",
      answer:
         "The S3 API supports DeleteObjects (plural) — up to 1,000 keys per request. S3 Viewer wraps it in checkbox multi-select, so ticking the rows and hitting Delete clears the lot in one round trip. From the CLI, `aws s3 rm --recursive` with a prefix does the same thing.",
   },
   {
      question: "What is MFA Delete in S3?",
      answer:
         "A bucket-level setting that requires the root account's MFA token to delete any version of any object. It's enabled via the AWS CLI (not the console), can only be toggled by the root account, and is the strongest accidental-deletion protection S3 offers.",
   },
   {
      question: "Does this work with Cloudflare R2?",
      answer:
         "R2 supports DeleteObject and bulk delete the same way. R2 has its own object versioning model — check the Cloudflare docs for current behavior.",
   },
];

export default createHowToPage({
   slug: SLUG,
   title: TITLE,
   tldr: TLDR,
   keyword: KEYWORD,
   seoTitle: "How to Delete a File From S3 Safely (Versioning, Bulk, MFA)",
   seoDescription:
      "Versioning, delete markers, MFA Delete — what aws s3 rm actually does. Plus how to bulk-delete with the DeleteObjects API.",
   visual: <DeleteIllustration />,
   steps,
   underTheHood: (
      <p>
         On a non-versioned bucket, <code>DeleteObject</code> removes the key
         immediately. On a versioned bucket, it writes a{" "}
         <strong>delete marker</strong> — the object becomes invisible to normal{" "}
         <code>GetObject</code> calls but every prior version is still there
         (and still billed). To actually purge a key, you delete each version
         explicitly via <code>delete-object --version-id</code>. S3 Viewer is
         not version-aware: it deletes the current version like any other S3
         client, so whether that is a soft or a hard delete depends on the
         bucket&apos;s versioning setting, which is worth checking before you
         rely on it. For several objects at once, S3 Viewer wraps the{" "}
         <code>DeleteObjects</code> API (up to 1,000 keys per call) — tick the
         checkboxes and clear them in one round trip.
      </p>
   ),
   faqs,
   useCases: getUseCaseRefs(["s3-browser", "security-and-audit"]),
   related: getRelatedHowTos([
      "rename-s3-file",
      "set-granular-s3-permissions",
      "search-across-s3-buckets",
   ]),
});
