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
   "On AWS S3, open the file menu in S3 Viewer and choose Delete, or select several files and confirm Delete. Each object must still match the one you reviewed. R2, B2, MinIO, and other endpoints do not execute object deletion through the app. Versioned AWS buckets keep prior versions behind a delete marker; unversioned deletion can be permanent. S3 Viewer does not purge historical versions.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: ⋮ → Delete",
      body: (
         <>
            On AWS S3, open the ⋮ menu on the object&apos;s row and choose{" "}
            <strong>Delete</strong>. To clear several at once, tick their
            checkboxes and use the <strong>Delete</strong> button in the toolbar
            — the selection is sent in batches of up to 1,000 keys. The
            confirmation shows how many objects you are about to delete. Each
            must still match the file you reviewed. R2, B2, MinIO, and other
            providers stop before deleting objects. Uncertain deletion requests
            are never automatically replayed; refresh and review them before
            another attempt.
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
            requires the root account&apos;s MFA token. Plan accordingly — this
            is on by design for compliance buckets.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "How do I delete a file from S3?",
      answer:
         "On AWS S3, open the file menu in S3 Viewer and choose Delete, or select several reviewed files and confirm Delete. The app rejects files that changed since review and blocks object deletion on other providers. The AWS CLI also supports aws s3 rm s3://bucket/key. On versioned buckets, ordinary deletion keeps prior versions behind a delete marker.",
   },
   {
      question: "Why does my deleted S3 file still appear?",
      answer:
         "Almost always versioning. On a versioned bucket, aws s3 rm adds a delete marker rather than purging the object — the prior versions are still there (and still billed). To fully remove the file, delete the specific version IDs with aws s3api delete-object --version-id.",
   },
   {
      question: "Can I undo a delete in S3?",
      answer:
         "Only if versioning was enabled when you deleted. Remove the delete marker (or restore the prior version) to bring the object back. Without versioning, S3 deletes are permanent — there is no recycle bin.",
   },
   {
      question: "How do I delete an entire S3 folder?",
      answer:
         "From the CLI: aws s3 rm s3://bucket/prefix/ --recursive lists every key under the prefix and deletes them. From S3 Viewer: open the ⋮ menu on the folder's row and choose Delete folder, which walks the prefix and deletes everything under it. Remember S3 has no folders — you're deleting every key sharing that prefix.",
   },
   {
      question: "How do I bulk-delete multiple S3 files?",
      answer:
         "On AWS S3, tick the rows in S3 Viewer and confirm Delete. The app sends batches of up to 1,000 reviewed files and reports per-file failures. Files that changed are not deleted. From the AWS CLI, aws s3 rm --recursive deletes a prefix; it is a separate workflow from the app's review checks.",
   },
   {
      question: "What is MFA Delete in S3?",
      answer:
         "A bucket-level setting that requires the root account's MFA token to delete any version of any object. It's enabled via the AWS CLI (not the console), can only be toggled by the root account, and is the strongest accidental-deletion protection S3 offers.",
   },
   {
      question: "Does this work with Cloudflare R2?",
      answer:
         "No. S3 Viewer currently blocks object, selection, and folder deletion on R2 because it cannot safely protect a file changed by another writer. R2 browsing, previews, downloads, uploads, and sharing remain available.",
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
         explicitly via <code>delete-object --version-id</code>. S3 Viewer does
         not purge specific historical versions. Deletion can be permanent on an
         unversioned bucket. For several objects at once, S3 Viewer uses the{" "}
         <code>DeleteObjects</code> API in batches on AWS S3 and checks that
         each file matches the one reviewed. Other providers do not execute
         object deletion through the app.
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
