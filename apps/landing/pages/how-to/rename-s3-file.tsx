import {
   createHowToPage,
   type HowToFAQ,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import { getRelatedHowTos } from "@/components/HowTo/data";
import { getUseCaseRefs } from "@/components/UseCases/data";
import { RenameIllustration } from "@/components/UseCases/illustrations";

const SLUG = "rename-s3-file";
const TITLE = "How to rename a file in S3 (and why it's tricky)";
const KEYWORD = "rename file in S3";
const TLDR =
   "Amazon S3 has no rename API — keys are immutable, by design. Cloudflare R2 follows the same S3 API and inherits the same constraint. To rename, you copy the object to the new key and delete the original. The AWS CLI does it with aws s3 mv; the SDKs do it with copyObject + deleteObject; S3 Viewer wraps the same pattern behind the ⋮ menu on a row: it copies the object with its metadata, then deletes the original. It refuses to overwrite an existing key and is limited to objects up to 5 GB.";

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
            overwriting it.
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
      title: "Files over 5 GB need multipart copy",
      body: (
         <>
            A single <code>CopyObject</code> call fails above 5 GB, so{" "}
            <strong>rename in S3 Viewer is limited to 5 GB</strong> and returns
            an error above it. For larger objects do the multipart copy from the
            CLI or an SDK: <code>CreateMultipartUpload</code> →{" "}
            <code>UploadPartCopy</code> for each part →{" "}
            <code>CompleteMultipartUpload</code>, then delete the source.{" "}
            <code>aws s3 mv</code> does all of that for you.
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

const faqs: HowToFAQ[] = [
   {
      question: "Can you rename a file in S3?",
      answer:
         "Not natively — Amazon S3 has no rename API and keys are immutable once written, by design. The standard pattern is to copy the object to the new key and delete the original. Every S3 tool does this under the hood, including the AWS CLI's aws s3 mv, the AWS SDKs' copyObject + deleteObject, and S3 Viewer's ⋮ menu → Rename.",
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
         "They carry over. CopyObject defaults MetadataDirective and TaggingDirective to COPY, so content-type, cache-control headers and object tags are preserved unless you explicitly pass REPLACE. S3 Viewer uses those defaults, so a rename does not strip them.",
   },
   {
      question: "Can I rename a file in Cloudflare R2?",
      answer:
         "Same answer — R2 implements the S3 API, and Amazon S3's no-rename design carries over. Use the same copy + delete pattern. S3 Viewer's rename works identically against R2 buckets: ⋮ → Rename, metadata preserved, up to 5 GB.",
   },
   {
      question: "How do I rename a folder in S3?",
      answer:
         "S3 has no folders — what looks like a folder is a shared key prefix. To rename a 'folder', list every object under the prefix and copy + delete each one to the new prefix. S3 Viewer renames one object at a time, so for a whole prefix use aws s3 mv s3://bucket/old-prefix/ s3://bucket/new-prefix/ --recursive or rclone.",
   },
];

export default createHowToPage({
   slug: SLUG,
   title: TITLE,
   tldr: TLDR,
   keyword: KEYWORD,
   seoTitle: "How to Rename a File in S3 (Copy + Delete Pattern Explained)",
   seoDescription:
      "Amazon S3 has no rename API — keys are immutable. The copy + delete pattern explained: what happens to metadata and tags, and what changes above 5 GB.",
   visual: <RenameIllustration />,
   steps,
   underTheHood: (
      <>
         <p>
            S3 is a flat key-value store. There is no <code>RenameObject</code>{" "}
            API call — keys are immutable once written, by design. Every
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
         <br />
         <p>
            Two things to handle: a single <code>CopyObject</code> fails above 5
            GB, and the pair of calls is not atomic, so a failure between copy
            and delete can leave you with two keys (or zero, if you deleted
            first). Metadata and tags carry over on their own —{" "}
            <code>MetadataDirective</code> and <code>TaggingDirective</code>{" "}
            both default to <code>COPY</code>.
         </p>
         <br />
         <p>
            S3 Viewer only deletes the source after the destination write
            returns success, refuses the rename when something already exists at
            the target key (you get a conflict error rather than a silent
            overwrite), and rejects objects over 5 GB — use the CLI or an SDK
            for those. The same pattern works against Cloudflare R2 and any
            other S3-compatible provider.
         </p>
      </>
   ),
   faqs,
   useCases: getUseCaseRefs(["s3-browser", "cloudflare-r2"]),
   related: getRelatedHowTos([
      "create-folder-in-s3",
      "delete-file-from-s3",
      "upload-large-files-to-s3",
   ]),
});
