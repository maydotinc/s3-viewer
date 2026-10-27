import {
   createHowToPage,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import type { Faq } from "@/lib/types";
import { RenameIllustration } from "@/components/UseCases/illustrations/how-to/rename";

const SLUG = "edit-s3-object-metadata";
const TLDR =
   "S3 has no UpdateObject call, so changing a stored header — content type, cache-control, content-disposition, content-language, content-encoding, Expires — or the custom metadata means copying the object onto itself with MetadataDirective set to REPLACE. S3 Viewer's Edit settings does exactly that on every provider, R2 included (up to 5 GiB per object), guarded by the same reviewed-ETag condition as every other write. Storage class, server-side encryption and, on AWS, ACL grants and tags all carry over; only the headers you changed are new.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: open the object and choose Edit settings",
      body: (
         <>
            Open the object and click <strong>Edit settings</strong>. Change the
            content type, cache-control, content-disposition, content-language,
            content-encoding or expires header, add or remove custom metadata
            keys, and save. S3 Viewer sends a self-copy with{" "}
            <code>MetadataDirective: REPLACE</code>, checks the object
            hasn&apos;t changed since you opened it, and refreshes the details
            panel once the write lands. Leave a field blank to remove that
            header entirely.
         </>
      ),
   },
   {
      title: "AWS CLI: copy-object onto itself",
      body: (
         <>
            <code>aws s3api copy-object</code> with the same bucket and key as
            both source and destination, plus{" "}
            <code>--metadata-directive REPLACE</code>, rewrites the
            object&apos;s headers without touching its bytes.
         </>
      ),
      code: `aws s3api copy-object \\
  --bucket my-bucket \\
  --copy-source my-bucket/reports/q3.pdf \\
  --key reports/q3.pdf \\
  --metadata-directive REPLACE \\
  --content-type application/pdf \\
  --cache-control "max-age=3600" \\
  --metadata reviewed=true`,
   },
   {
      title: "AWS SDK: copyObject with MetadataDirective REPLACE",
      body: (
         <>
            Without <code>MetadataDirective: &quot;REPLACE&quot;</code>,{" "}
            <code>copyObject</code> defaults to <code>COPY</code> and keeps the
            source&apos;s headers and metadata untouched — REPLACE is what makes
            this a settings edit rather than a plain duplicate.
         </>
      ),
      code: `await s3.copyObject({
  Bucket: 'my-bucket',
  CopySource: 'my-bucket/reports/q3.pdf',
  Key: 'reports/q3.pdf',
  MetadataDirective: 'REPLACE',
  ContentType: 'application/pdf',
  CacheControl: 'max-age=3600',
  Metadata: { reviewed: 'true' },
});`,
   },
   {
      title: "Only the source needs to be unchanged, not the destination",
      body: (
         <>
            Because the destination key <em>is</em> the source key, there is
            nothing to check for &ldquo;already exists&rdquo; — S3 Viewer&apos;s
            only condition is that the object still matches the ETag you
            reviewed before opening the dialog. A source that changed underneath
            you refuses the write with a 409 instead of overwriting whatever is
            there now.
         </>
      ),
   },
   {
      title: "Metadata keys and sizes follow S3's own limits",
      body: (
         <>
            Custom metadata keys are lower-cased, limited to 64 characters of{" "}
            <code>a-z0-9-</code>, capped at 50 keys, 1 KiB per value and 2 KiB
            total across all of them — S3&apos;s own ceiling for the{" "}
            <code>x-amz-meta-*</code> headers, not something S3 Viewer invented.
            A key or value outside those limits is rejected before anything is
            sent.
         </>
      ),
   },
   {
      title: "Objects over 5 GB copy in parts, automatically",
      body: (
         <>
            The same 5 GB ceiling that applies to a plain{" "}
            <code>CopyObject</code> applies to a self-copy. S3 Viewer switches
            to a multipart copy above that size — initiating the multipart
            upload with the new headers, then copying each part from the source.
            On Cloudflare R2, settings edits stop at 5 GiB per object instead.
         </>
      ),
   },
];

const faqs: Faq[] = [
   {
      question: "Can I change an S3 object's content type after uploading it?",
      answer:
         "Yes, but not by editing it in place — S3 has no call for that. Copy the object onto itself with copyObject (or aws s3api copy-object) and MetadataDirective set to REPLACE, passing the new ContentType. S3 Viewer's Edit settings does this from the object page on every provider, including R2.",
   },
   {
      question: "How do I add or remove custom metadata on an S3 object?",
      answer:
         "Same self-copy, REPLACE directive, with the Metadata (or --metadata) you want the object to end up with — REPLACE means the whole metadata set is what you send, not merged with what was already there. Leaving a standard header like content-disposition blank removes it from the new object.",
   },
   {
      question: "Does changing metadata re-upload the file?",
      answer:
         "No. CopyObject is server-side: the bytes are copied inside the storage provider, not downloaded and re-uploaded. Only the request and response travel over the network, which is why a settings edit on a multi-gigabyte file is fast regardless of your connection.",
   },
   {
      question:
         "What happens to tags, ACLs and storage class when I edit settings?",
      answer:
         "S3 Viewer carries storage class and server-side encryption over automatically, and on AWS also preserves object ACL grants and tags via TaggingDirective: COPY, best-effort — a failed read of either just means the new object gets the bucket's defaults instead, never a blocked edit. R2 has no ACL or tag API, so there's nothing to preserve or drop there.",
   },
   {
      question:
         "Can I change content type or metadata on a Cloudflare R2 object?",
      answer:
         "Yes. R2 supports a self-copy with MetadataDirective REPLACE the same way AWS S3 does, so S3 Viewer's Edit settings works identically there.",
   },
   {
      question:
         "Why does S3 Viewer ask me to reload after a settings edit fails?",
      answer:
         "A 409 means the object changed after you opened Edit settings — someone replaced it, or another edit landed first. S3 Viewer's self-copy carries a condition on the ETag you reviewed, so it refuses to overwrite whatever is there now rather than guessing which version's headers you meant to set. Reload the object and try again.",
   },
];

export default createHowToPage({
   slug: SLUG,
   tldr: TLDR,
   seoTitle: "Change an S3 Object's Content Type or Metadata",
   seoDescription:
      "S3 has no UpdateObject call. Change a stored object's content type, cache headers or custom metadata with a self-copy and MetadataDirective REPLACE.",
   published: "2026-09-07",
   updated: "2026-10-12",
   visual: <RenameIllustration />,
   steps,
   underTheHood: (
      <>
         <p>
            Every header S3 stores alongside an object&apos;s bytes — content
            type, cache-control, content-disposition, content-language,
            content-encoding, <code>Expires</code>, and custom{" "}
            <code>x-amz-meta-*</code> metadata — is set once, at write time, and
            there is no API call that changes it without rewriting the object.{" "}
            <code>CopyObject</code> is the write S3 Viewer reuses for this:
            point the copy source and destination at the same bucket and key,
            set <code>MetadataDirective</code> to <code>REPLACE</code>, and the
            object&apos;s bytes are copied onto themselves while every header
            you pass becomes the new one.
         </p>
         <p>
            The one thing that has to be handled carefully is the precondition.
            A normal copy protects the destination with <code>IfNoneMatch</code>{" "}
            — refuse if something is already there. That&apos;s meaningless
            here, since the destination is the source. Instead S3 Viewer
            conditions the write on <code>CopySourceIfMatch</code>, the ETag you
            reviewed when you opened the settings dialog, so an object someone
            else changed in the meantime is never silently overwritten with
            stale headers.
         </p>
         <p>
            This works the same way on AWS S3, R2, B2 and MinIO: a self-copy
            with <code>REPLACE</code> is a standard part of the S3 API, not an
            AWS extension. Where a provider doesn&apos;t enforce the source
            condition itself, S3 Viewer checks it with a HEAD request
            immediately beforehand instead — the same conditional-or-checked
            split every mutation in S3 Viewer follows.
         </p>
      </>
   ),
   faqs,
   useCases: ["s3-browser", "cloudflare-r2"],
   related: ["edit-file-in-s3", "rename-s3-file", "upload-large-files-to-s3"],
});
