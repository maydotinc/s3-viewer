import {
   createHowToPage,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import type { Faq } from "@/lib/types";
import { RenameIllustration } from "@/components/UseCases/illustrations/how-to/rename";

const SLUG = "rename-s3-file";
const TLDR =
   "On a general purpose S3 bucket, renaming an object means copying it to a new key and removing the original. S3 Viewer does this server-side on every provider — AWS S3, Cloudflare R2, Backblaze B2, MinIO, and other S3-compatible endpoints. Objects above 5 GB copy in multipart parts automatically, except on R2, where rename stops at 5 GiB per object. It refuses an occupied destination and rejects a source that changed since you reviewed it. Folder rename moves every object under the prefix the same way, and Copy to… and New folder use the same server-side copy.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: open the ⋮ menu and choose Rename",
      body: (
         <>
            Open the ⋮ menu on the object&apos;s row and choose{" "}
            <strong>Rename</strong>, then type the new key. S3 Viewer issues a
            server-side <code>CopyObject</code>, which preserves the
            object&apos;s metadata, then issues <code>DeleteObject</code> on the
            source — only confirming the rename once both succeed. If an object
            already exists at the new key the rename is refused rather than
            overwriting it. The file must still match the one you reviewed: an
            ETag check catches a source that changed underneath you and refuses
            the rename instead of copying stale bytes. This works the same way
            on AWS S3, R2, B2, and every other connected provider.
         </>
      ),
   },
   {
      title: "AWS CLI: aws s3 mv",
      body: (
         <>
            From a terminal, <code>aws s3 mv</code> performs a server-side copy
            then a delete. The bytes never leave AWS — there&apos;s no data
            transfer to your machine.
         </>
      ),
      code: "aws s3 mv s3://my-bucket/old-key.png s3://my-bucket/new-key.png",
   },
   {
      title: "AWS SDK: copyObject + deleteObject",
      body: (
         <>
            If you&apos;re scripting it, run <code>copyObject</code> followed by{" "}
            <code>deleteObject</code>. Always verify the copy succeeded (HTTP
            200 and matching ETag) before deleting the source.{" "}
            <code>MetadataDirective</code> and <code>TaggingDirective</code>{" "}
            both default to <code>COPY</code>, so metadata and tags carry over
            unless you explicitly ask for <code>REPLACE</code>.
         </>
      ),
      code: `const copy = await s3.copyObject({\n  CopySource: 'my-bucket/old.png',\n  Bucket: 'my-bucket',\n  Key: 'new.png',\n  MetadataDirective: 'COPY',\n  TaggingDirective: 'COPY',\n});\nawait s3.deleteObject({ Bucket: 'my-bucket', Key: 'old.png' });`,
   },
   {
      title: "Files over 5 GB copy in parts, automatically",
      body: (
         <>
            A single <code>CopyObject</code> call fails above 5 GB, so S3 Viewer
            switches to a multipart copy automatically —{" "}
            <code>CreateMultipartUpload</code> → <code>UploadPartCopy</code> for
            each part → <code>CompleteMultipartUpload</code> — then deletes the
            source. On Cloudflare R2, S3 Viewer refuses to rename objects above
            5 GiB instead. Scripting it yourself without the app,{" "}
            <code>aws s3 mv</code> does the same thing for you.
         </>
      ),
   },
   {
      title: "Verify, then delete",
      body: (
         <>
            Confirm the new key exists with the right size and ETag before
            deleting the source. If you skip this and the copy silently fails,
            you can lose the file — there is no S3 undo.
         </>
      ),
   },
   {
      title: "Update anything that referenced the old key",
      body: (
         <>
            CDN cache, presigned URLs, database rows, hard-coded asset paths.
            Renaming an object doesn&apos;t propagate — that&apos;s on you,
            regardless of which tool you used.
         </>
      ),
   },
];

const faqs: Faq[] = [
   {
      question: "Can you rename a file in S3?",
      answer:
         "Not natively on a general purpose bucket — there is no rename API for it and keys are immutable once written, by design. The standard pattern is to copy the object to the new key and delete the original. Every S3 tool does this under the hood, including the AWS CLI's aws s3 mv, the AWS SDKs' copyObject + deleteObject, and S3 Viewer's ⋮ menu → Rename, which works this way on AWS S3, R2, B2, and other S3-compatible endpoints alike. The one exception is AWS's RenameObject call, which only works on S3 Express One Zone directory buckets.",
   },
   {
      question: "Doesn't S3 have a RenameObject API now?",
      answer:
         "Only for S3 Express One Zone directory buckets, where AWS added an atomic RenameObject call in 2025. General purpose buckets — the kind almost everyone uses — don't support it, and Cloudflare R2 and Backblaze B2 don't document an equivalent. S3 Viewer doesn't connect to directory buckets, so it never sends the call, and it won't try it speculatively elsewhere: an endpoint that doesn't recognise the request can treat it as an ordinary upload and leave an empty object at the new key. Copy then delete behaves the same on every provider, so that is what S3 Viewer uses.",
   },
   {
      question: "How do I rename a file in S3 with the AWS CLI?",
      answer:
         "Run aws s3 mv s3://bucket/old-key s3://bucket/new-key. The CLI performs a server-side CopyObject followed by a DeleteObject. The bytes never download to your machine.",
   },
   {
      question: "Does renaming an S3 file cost money?",
      answer:
         "Yes, a small amount. You pay for one CopyObject request and one DeleteObject request. The copy is server-side so there's no data transfer charge for same-region copies, but cross-region copies pay inter-region transfer rates.",
   },
   {
      question: "What happens to metadata and tags when I rename an S3 object?",
      answer:
         "S3 Viewer preserves readable metadata, tags, permissions, and supported storage settings during rename, on every provider. A failed read of ACLs or tags never blocks the rename — it just means the new object gets the bucket's default settings instead. Only an object encrypted with a customer-supplied key (SSE-C) refuses rename, since S3 Viewer never has that key.",
   },
   {
      question: "Can I rename a file in Cloudflare R2?",
      answer:
         "Yes. S3 Viewer renames R2 objects the same way it renames AWS S3 objects: a server-side copy followed by a delete. R2 doesn't offer a delete-time condition, so S3 Viewer checks the object is still the one you reviewed with a HEAD request immediately before deleting it, rather than trusting an R2-enforced condition the way it can on AWS.",
   },
   {
      question: "How do I rename a folder in S3?",
      answer:
         "S3 has no folders — what looks like a folder is a shared key prefix. To rename a 'folder', every object under the prefix has to be copied and deleted to the new prefix. S3 Viewer's Rename folder action does exactly that: it lists every key under the old prefix and moves each one to the new prefix, showing progress and any per-object failures. From the CLI, aws s3 mv s3://bucket/old-prefix/ s3://bucket/new-prefix/ --recursive or rclone do the same thing.",
   },
];

export default createHowToPage({
   slug: SLUG,
   heading: "How to rename a file in S3 (and why it's tricky)",
   tldr: TLDR,
   seoTitle: "How to Rename a File in S3 (Copy + Delete)",
   seoDescription:
      "General purpose S3 buckets have no rename API. The copy + delete pattern explained: what happens to metadata and tags, and multipart copy past 5 GB.",
   published: "2026-04-28",
   visual: <RenameIllustration />,
   steps,
   underTheHood: (
      <>
         <p>
            S3 is a flat key-value store. On a general purpose bucket there is
            no rename call — keys are immutable once written, by design. Every
            &ldquo;rename&rdquo; in any S3 tool is the same two operations:{" "}
            <strong>
               <code>CopyObject</code> to write the bytes at the new key
               (server-side, no download)
            </strong>
            , then{" "}
            <strong>
               <code>DeleteObject</code>
            </strong>{" "}
            on the old key.
         </p>
         <p>
            Two things to handle: a single <code>CopyObject</code> fails above 5
            GB, and the pair of calls is not atomic, so a failure between copy
            and delete can leave you with two keys (or zero, if you deleted
            first). Metadata and tags carry over on their own —{" "}
            <code>MetadataDirective</code> and <code>TaggingDirective</code>{" "}
            both default to <code>COPY</code>.
         </p>
         <p>
            S3 Viewer checks that the source is unchanged before copying and
            deleting it, refuses the rename when something already exists at the
            target key (you get a conflict error rather than a silent
            overwrite), and switches to a multipart copy above 5 GB instead of
            rejecting the file, except on R2, where it stops at 5 GiB. This
            works on AWS S3, R2, B2, and other connected providers, using
            whichever conditional headers each one enforces and a check
            immediately beforehand where it doesn&apos;t. Copy and delete are
            still separate calls, not one atomic operation: an external writer
            can still race them, and if the delete step fails after a successful
            copy, S3 Viewer says so rather than guessing — it never deletes a
            destination it just created to undo a partial rename.
         </p>
         <p>
            AWS does have a <code>RenameObject</code> call, but only for S3
            Express One Zone directory buckets. General purpose buckets
            don&apos;t support it, R2 and B2 don&apos;t document an equivalent,
            and S3 Viewer doesn&apos;t connect to directory buckets — so it
            never sends it. Trying it speculatively isn&apos;t safe either: an
            endpoint that doesn&apos;t recognise the request can treat it as an
            ordinary upload and leave an empty object at the new key. Copy then
            delete behaves the same everywhere, which is why S3 Viewer uses it
            on every provider.
         </p>
      </>
   ),
   faqs,
   useCases: ["s3-browser", "cloudflare-r2"],
   related: [
      "create-folder-in-s3",
      "delete-file-from-s3",
      "upload-large-files-to-s3",
   ],
});
