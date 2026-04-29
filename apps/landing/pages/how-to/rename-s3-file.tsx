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
   "S3 has no rename API — you have to copy the object to the new key and delete the old one. S3 Viewer does both atomically and shows it as a single rename action; in the AWS CLI it's `aws s3 mv s3://bucket/old s3://bucket/new`.";

const steps: HowToStep[] = [
   {
      title: "Open the file in S3 Viewer",
      body: (
         <>
            Right-click the object (or hit <code>R</code>) and choose Rename.
            Type the new key. We handle the copy + delete behind the scenes
            and only confirm the rename when both succeed.
         </>
      ),
   },
   {
      title: "CLI alternative: aws s3 mv",
      body: (
         <>
            <code>aws s3 mv</code> performs a server-side copy and then a
            delete. There&apos;s no data transferred to your machine — the
            bytes never leave AWS.
         </>
      ),
      code: "aws s3 mv s3://my-bucket/old-key.png s3://my-bucket/new-key.png",
   },
   {
      title: "SDK alternative: copy then delete",
      body: (
         <>
            If you&apos;re scripting it, run <code>copyObject</code> followed
            by <code>deleteObject</code>. Always verify the copy succeeded
            before deleting.
         </>
      ),
      code: `const copy = await s3.copyObject({\n  CopySource: 'my-bucket/old.png',\n  Bucket: 'my-bucket',\n  Key: 'new.png',\n  MetadataDirective: 'COPY',\n});\nawait s3.deleteObject({ Bucket: 'my-bucket', Key: 'old.png' });`,
   },
   {
      title: "Preserve metadata",
      body: (
         <>
            By default, <code>CopyObject</code> replaces metadata. Pass{" "}
            <code>MetadataDirective: &apos;COPY&apos;</code> to keep
            content-type, cache-control, and custom user metadata. For tags,
            pass <code>TaggingDirective: &apos;COPY&apos;</code>. S3 Viewer
            sets both by default.
         </>
      ),
   },
   {
      title: "Handle large files",
      body: (
         <>
            Single <code>CopyObject</code> calls fail above 5 GB. You need
            multipart copy: <code>CreateMultipartUpload</code> →{" "}
            <code>UploadPartCopy</code> for each part →{" "}
            <code>CompleteMultipartUpload</code>. S3 Viewer switches to
            multipart copy automatically above 5 GB.
         </>
      ),
   },
   {
      title: "Verify, then delete",
      body: (
         <>
            Confirm the new key exists with the right size and ETag before
            deleting the source. If you skip this step and the copy silently
            fails, you can lose the file.
         </>
      ),
   },
   {
      title: "Update anything that references the old key",
      body: (
         <>
            CDN cache, signed URLs, database rows, hard-coded asset paths.
            Renaming doesn&apos;t propagate — that&apos;s on you.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "Can you rename a file in S3?",
      answer:
         "Not natively — S3 has no rename API. The standard approach is to copy the object to the new key and delete the old one, which every S3 tool (including the AWS CLI's aws s3 mv) does behind the scenes.",
   },
   {
      question: "Does renaming an S3 file cost money?",
      answer:
         "Yes, a small amount. You pay for one CopyObject request and one DeleteObject request. The copy is server-side so there's no data transfer charge, but cross-region copies pay inter-region transfer rates.",
   },
   {
      question: "What happens to metadata when I rename an S3 object?",
      answer:
         "By default CopyObject replaces metadata. To preserve it, set MetadataDirective to COPY (and TaggingDirective to COPY for tags). S3 Viewer does this for you.",
   },
];

const Page = () => {
   const jsonLd = buildHowToJsonLd({
      slug: SLUG,
      title: TITLE,
      tldr: TLDR.replace(/`/g, ""),
      siteUrl: SITE_URL,
      steps,
      faqs,
      keyword: KEYWORD,
   });

   return (
      <>
         <Seo
            title="How to Rename a File in S3 (and Why It's Tricky)"
            description="S3 has no rename API. Here's how to rename an S3 object safely — copy + delete, metadata, large files, and the gotchas."
            canonical={`/how-to/${SLUG}`}
            jsonLd={jsonLd}
         />
         <HowToPage
            eyebrow={TITLE}
            title={TITLE}
            tldr="S3 has no rename API — you have to copy the object to the new key and delete the old one. S3 Viewer does both atomically and shows it as a single rename action; in the AWS CLI, run aws s3 mv s3://bucket/old s3://bucket/new."
            visual={<RenameIllustration />}
            steps={steps}
            underTheHood={
               <>
                  <p>
                     S3 is a flat key-value store. There is no{" "}
                     <code>RenameObject</code> API call — keys are immutable
                     once written. Every &ldquo;rename&rdquo; in any S3 tool is
                     the same two operations:{" "}
                     <strong>
                        <code>CopyObject</code> to write the bytes at the new
                        key (server-side, no download)
                     </strong>
                     , then <strong>
                        <code>DeleteObject</code>
                     </strong>{" "}
                     on the old key.
                  </p>
                  <br />
                  <p>
                     The gotchas: copies over 5 GB require multipart copy;
                     metadata and ACLs are preserved only if you pass the
                     right directives; the operation is not atomic, so a
                     failure between copy and delete can leave both keys
                     present. S3 Viewer handles all three: it uses multipart
                     copy above 5 GB, copies metadata, content-type, and ACL
                     by default, and only deletes the source after the
                     destination write returns success.
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
