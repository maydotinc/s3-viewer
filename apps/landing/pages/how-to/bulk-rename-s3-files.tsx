import {
   createHowToPage,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import type { Faq } from "@/lib/types";
import { RenameIllustration } from "@/components/UseCases/illustrations/how-to/rename";

const SLUG = "bulk-rename-s3-files";
const TLDR =
   "S3 has no batch-rename call — renaming is always copy-then-delete, one key at a time, whether you script it or click a button. S3 Viewer's Bulk rename… runs a pattern (find/replace, add a prefix or suffix, change the extension, or lowercase every key) over a selection or a whole folder, shows you every resulting old-to-new name before touching anything, and blocks the run if two files would collide or a target key already exists. Then it executes the same per-object rename S3 Viewer already uses everywhere else, with progress and per-file failures.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: select files (or a folder) and choose Bulk rename…",
      body: (
         <>
            Select the rows you want, or open a folder&apos;s ⋮ menu, and choose{" "}
            <strong>Bulk rename…</strong>. Pick an operation — find/replace
            (with a case-sensitive toggle and a choice between the first match
            and all occurrences), add a prefix, add a suffix before the
            extension, change the extension, or lowercase every name.
         </>
      ),
   },
   {
      title: "Review the preview before running anything",
      body: (
         <>
            The dialog shows old → new for up to the first 200 changed names,
            with the total count above it; names the pattern doesn&apos;t change
            are skipped rather than listed. If two files would land on the same
            new key, or a target key already exists in the bucket, those rows
            are flagged and the run is blocked until you adjust the pattern.
         </>
      ),
   },
   {
      title: "AWS CLI: script it yourself",
      body: (
         <>
            There&apos;s no batch-rename flag on <code>aws s3</code> — loop over{" "}
            <code>aws s3 ls</code> output (or{" "}
            <code>aws s3api list-objects-v2</code> for exact keys) and run{" "}
            <code>aws s3 mv</code> per file, building the new key with{" "}
            <code>sed</code> or your shell&apos;s own string substitution.
         </>
      ),
      code: `aws s3 ls s3://my-bucket/exports/ | awk '{print $4}' | while read -r key; do
  new="\${key/draft-/final-}"
  [ "$key" = "$new" ] && continue
  aws s3 mv "s3://my-bucket/exports/$key" "s3://my-bucket/exports/$new"
done`,
   },
   {
      title: "SDK: compute every new key, then copy + delete each one",
      body: (
         <>
            A script version of the same idea: list the keys, transform each one
            with your pattern, skip the ones that don&apos;t change, and run{" "}
            <code>copyObject</code> + <code>deleteObject</code> for the rest —
            checking that the copy actually succeeded before deleting the
            source, the same way any rename should.
         </>
      ),
      code: `for (const key of keys) {
  const newKey = key.replace(/^draft-/, 'final-');
  if (newKey === key) continue;
  await s3.copyObject({ Bucket, CopySource: \`\${Bucket}/\${key}\`, Key: newKey });
  await s3.deleteObject({ Bucket, Key: key });
}`,
   },
   {
      title: "It's still N renames, not one atomic operation",
      body: (
         <>
            Bulk rename runs the same per-object copy-then-delete as a single
            rename, just for every matched key — it isn&apos;t a single S3 call
            and isn&apos;t atomic across the batch. S3 Viewer reports progress
            and per-file failures rather than an all-or-nothing result, and the
            run is resumable if you stop partway through: files already renamed
            aren&apos;t retried.
         </>
      ),
   },
];

const faqs: Faq[] = [
   {
      question: "Can I rename multiple S3 files at once?",
      answer:
         "Not with one API call — S3 has no batch rename, only per-object copy and delete. S3 Viewer's Bulk rename… applies a pattern (find/replace, add a prefix or suffix, change the extension, or lowercase) across a selection or a folder, previews every resulting name, and then runs the same per-object rename for each matched file, with progress shown as it goes.",
   },
   {
      question: "How do I find and replace text in S3 file names?",
      answer:
         "In S3 Viewer, Bulk rename… → Find/replace, with a case-sensitive toggle and a choice of replacing only the first match or every occurrence in each key. From a script, loop over the keys yourself and apply a string replace before calling copyObject + deleteObject on the ones that actually change.",
   },
   {
      question:
         "What happens if a bulk rename would create duplicate file names?",
      answer:
         "S3 Viewer checks the computed target keys against each other and against what's already in the bucket (via a batched existence check) before the run starts. Any collision — two source files mapping to the same new key, or a new key that's already occupied — is flagged in the preview table and blocks Run until you change the pattern.",
   },
   {
      question: "Does bulk rename work on a whole folder in S3?",
      answer:
         "Yes — choosing Bulk rename… from a folder's menu lists every key under that prefix the same way folder delete and folder move do, applies the pattern to each, and previews and runs the result the same as a selection.",
   },
   {
      question: "Is bulk renaming S3 files reversible?",
      answer:
         "No more than a single rename is: each file is copied to its new key and the original deleted. There's no S3 undo. Review the preview table carefully, and note the pattern down (or keep the S3 Viewer activity log if your server has it enabled) if you might need to reverse it.",
   },
   {
      question: "Does bulk rename cost more than a normal rename?",
      answer:
         "The same per-object cost as N individual renames — one CopyObject and one DeleteObject request per file that actually changes. There's no batch discount, since it's still N separate operations under the hood; files the pattern doesn't change aren't touched at all.",
   },
];

export default createHowToPage({
   slug: SLUG,
   tldr: TLDR,
   seoTitle: "How to Bulk-Rename S3 Files by Pattern",
   seoDescription:
      "S3 has no batch rename call. Bulk-rename a selection or folder by find/replace, prefix, suffix or extension, with a preview before anything runs.",
   published: "2026-09-07",
   updated: "2026-10-12",
   visual: <RenameIllustration />,
   steps,
   underTheHood: (
      <>
         <p>
            A &ldquo;bulk rename&rdquo; is never one operation on S3 — it&apos;s
            the same <code>CopyObject</code> + <code>DeleteObject</code> pair a
            single rename uses, repeated once per key that actually changes. S3
            Viewer&apos;s part is entirely client-side pattern matching: given
            the operation you picked, it computes every new key locally, drops
            the ones that are identical to the original, and only then talks to
            the API.
         </p>
         <p>
            Before running anything, it checks the computed keys for internal
            collisions (two sources landing on the same target) and for
            collisions with what&apos;s already in the bucket, using the same
            chunked existence check the upload flow uses for duplicate
            detection. Either kind of collision blocks the run — there is no
            &ldquo;last write wins&rdquo; fallback.
         </p>
         <p>
            Execution reuses the existing per-object rename path (files) or the
            same relist-then-move chunking folder rename already does (folders),
            at bounded concurrency, with progress and per-key failures surfaced
            rather than a single pass/fail result — and it&apos;s resumable,
            since a file already renamed is never retried on a second pass.
         </p>
      </>
   ),
   faqs,
   useCases: ["s3-browser", "cloudflare-r2"],
   related: ["rename-s3-file", "bulk-delete-s3-files", "create-folder-in-s3"],
});
