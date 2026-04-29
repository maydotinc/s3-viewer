import { getRelatedHowTos } from "@/components/HowTo/data";
import HowToPage, {
   type HowToFAQ,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import { buildHowToJsonLd } from "@/components/HowTo/jsonld";
import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { getUseCaseRefs } from "@/components/UseCases/data";
import { RenameIllustration } from "@/components/UseCases/illustrations";
import { SITE_URL } from "@/lib/site-config";

const SLUG = "rename-s3-file";
const TITLE = "How to rename a file in S3 (and why it's tricky)";
const KEYWORD = "rename file in S3";
const TLDR =
   "Amazon S3 has no rename API — keys are immutable, by design. Cloudflare R2 follows the same S3 API and inherits the same constraint. To rename, you copy the object to the new key and delete the original. The AWS CLI does it with `aws s3 mv`; the SDKs do it with copyObject + deleteObject; S3 Viewer wraps the same pattern in a single right-click and preserves metadata and tags by default.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: right-click → Rename",
      body: (
         <>
            Right-click any object in the file browser, choose Rename, type
            the new key. S3 Viewer issues a server-side{" "}
            <code>CopyObject</code> with{" "}
            <code>MetadataDirective: &apos;COPY&apos;</code> and{" "}
            <code>TaggingDirective: &apos;COPY&apos;</code>, verifies the
            destination, then issues <code>DeleteObject</code> on the source
            — only confirming the rename when both succeed.
         </>
      ),
   },
   {
      title: "AWS CLI: aws s3 mv",
      body: (
         <>
            From a terminal, <code>aws s3 mv</code> performs a server-side
            copy then a delete. The bytes never leave AWS — there&apos;s no
            data transfer to your machine.
         </>
      ),
      code: "aws s3 mv s3://my-bucket/old-key.png s3://my-bucket/new-key.png",
   },
   {
      title: "AWS SDK: copyObject + deleteObject",
      body: (
         <>
            If you&apos;re scripting it, run <code>copyObject</code>{" "}
            followed by <code>deleteObject</code>. Always verify the copy
            succeeded (HTTP 200 and matching ETag) before deleting the
            source. Pass <code>MetadataDirective: &apos;COPY&apos;</code>{" "}
            and <code>TaggingDirective: &apos;COPY&apos;</code> or you
            silently lose metadata and tags — the SDK defaults replace
            them.
         </>
      ),
      code: `const copy = await s3.copyObject({\n  CopySource: 'my-bucket/old.png',\n  Bucket: 'my-bucket',\n  Key: 'new.png',\n  MetadataDirective: 'COPY',\n  TaggingDirective: 'COPY',\n});\nawait s3.deleteObject({ Bucket: 'my-bucket', Key: 'old.png' });`,
   },
   {
      title: "Files over 5 GB need multipart copy",
      body: (
         <>
            A single <code>CopyObject</code> call fails above 5 GB. Switch
            to multipart copy: <code>CreateMultipartUpload</code> →{" "}
            <code>UploadPartCopy</code> for each part →{" "}
            <code>CompleteMultipartUpload</code>. S3 Viewer makes this
            switch automatically the moment the source object crosses 5
            GB — you don&apos;t think about it.
         </>
      ),
   },
   {
      title: "Verify, then delete",
      body: (
         <>
            Confirm the new key exists with the right size and ETag before
            deleting the source. If you skip this and the copy silently
            fails, you can lose the file — there is no S3 undo.
         </>
      ),
   },
   {
      title: "Update anything that referenced the old key",
      body: (
         <>
            CDN cache, presigned URLs, database rows, hard-coded asset
            paths. Renaming an object doesn&apos;t propagate — that&apos;s
            on you, regardless of which tool you used.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "Can you rename a file in S3?",
      answer:
         "Not natively — Amazon S3 has no rename API and keys are immutable once written, by design. The standard pattern is to copy the object to the new key and delete the original. Every S3 tool does this under the hood, including the AWS CLI's `aws s3 mv`, the AWS SDKs' copyObject + deleteObject, and S3 Viewer's right-click → Rename.",
   },
   {
      question: "How do I rename a file in S3 with the AWS CLI?",
      answer:
         "Run `aws s3 mv s3://bucket/old-key s3://bucket/new-key`. The CLI performs a server-side CopyObject followed by a DeleteObject. The bytes never download to your machine.",
   },
   {
      question: "Does renaming an S3 file cost money?",
      answer:
         "Yes, a small amount. You pay for one CopyObject request and one DeleteObject request. The copy is server-side so there's no data transfer charge for same-region copies, but cross-region copies pay inter-region transfer rates.",
   },
   {
      question: "What happens to metadata and tags when I rename an S3 object?",
      answer:
         "By default CopyObject replaces metadata and drops tags — the SDK and CLI defaults are not preservation. To preserve metadata, set MetadataDirective to COPY. To preserve tags, set TaggingDirective to COPY. S3 Viewer sets both by default, so renaming doesn't silently strip your cache-control headers or object tags.",
   },
   {
      question: "Can I rename a file in Cloudflare R2?",
      answer:
         "Same answer — R2 implements the S3 API, and Amazon S3's no-rename design carries over. Use the same copy + delete pattern. S3 Viewer's rename works identically against R2 buckets: one right-click, metadata preserved, multipart copy above 5 GB.",
   },
   {
      question: "How do I rename a folder in S3?",
      answer:
         "S3 has no folders — what looks like a folder is a shared key prefix. To rename a 'folder', list every object under the prefix and copy + delete each one to the new prefix. S3 Viewer handles this when you rename a prefix in the UI; doing it by hand means doing it once per file.",
   },
];

const Page = () => {
   const jsonLd = buildHowToJsonLd({
      slug: SLUG,
      title: TITLE,
      tldr: TLDR,
      siteUrl: SITE_URL,
      steps,
      faqs,
      keyword: KEYWORD,
   });

   return (
      <>
         <Seo
            title="How to Rename a File in S3 (Copy + Delete Pattern Explained)"
            description="Amazon S3 has no rename API — keys are immutable. Here's the standard copy + delete pattern, how to preserve metadata and tags, what happens above 5 GB, and the one-click S3 Viewer wrapper."
            canonical={`/how-to/${SLUG}`}
            jsonLd={jsonLd}
         />
         <HowToPage
            eyebrow={TITLE}
            title={TITLE}
            tldr={TLDR}
            visual={<RenameIllustration />}
            steps={steps}
            underTheHood={
               <>
                  <p>
                     S3 is a flat key-value store. There is no{" "}
                     <code>RenameObject</code> API call — keys are immutable
                     once written, by design. Every &ldquo;rename&rdquo;
                     in any S3 tool is the same two operations:{" "}
                     <strong>
                        <code>CopyObject</code> to write the bytes at the new
                        key (server-side, no download)
                     </strong>
                     , then{" "}
                     <strong>
                        <code>DeleteObject</code>
                     </strong>{" "}
                     on the old key.
                  </p>
                  <br />
                  <p>
                     Three things to handle: copies over 5 GB need multipart
                     copy; metadata and tags are dropped unless you pass{" "}
                     <code>MetadataDirective: &apos;COPY&apos;</code> and{" "}
                     <code>TaggingDirective: &apos;COPY&apos;</code>; and the
                     operation is not atomic, so a failure between copy and
                     delete can leave you with two keys (or zero, if you
                     deleted first).
                  </p>
                  <br />
                  <p>
                     S3 Viewer handles all three: it issues a multipart copy
                     above the threshold, sets <code>MetadataDirective</code>{" "}
                     and <code>TaggingDirective</code> to{" "}
                     <code>COPY</code> by default, and only deletes the
                     source after the destination write returns success.
                     The same pattern works against Cloudflare R2 and any
                     other S3-compatible provider.
                  </p>
               </>
            }
            faqs={faqs}
            useCases={getUseCaseRefs(["s3-browser", "cloudflare-r2"])}
            related={getRelatedHowTos([
               "delete-file-from-s3",
               "upload-large-files-to-s3",
               "download-file-from-s3",
            ])}
         />
      </>
   );
};

Page.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default Page;
