import {
   createHowToPage,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import type { Faq } from "@/lib/types";
import { SearchIllustration } from "@/components/UseCases/illustrations/how-to/search";

const SLUG = "edit-file-in-s3";
const TLDR =
   "S3 has no edit API, only GetObject and PutObject — every 'edit' is really a full read, a change, and a full conditional rewrite of the object. For small text files (JSON, YAML, Markdown, config, .env, logs, and similar, up to 1 MB in S3 Viewer) that loop is fast enough to feel instant. S3 Viewer's Edit button opens a text-like object directly in the browser and saves it back with the same reviewed-ETag condition every replacement uses, so a change made elsewhere in the meantime is caught instead of silently overwritten.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: click Edit on a text-like object",
      body: (
         <>
            Open an object with a text-like content type or extension (
            <code>.json</code>, <code>.yml</code>, <code>.md</code>,{" "}
            <code>.csv</code>, <code>.env</code>, <code>.log</code>, and
            similar) under 1 MB and click <strong>Edit</strong>. The preview
            switches to a plain-text editor with line numbers; a dirty indicator
            marks unsaved changes, and <kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+
            <kbd>S</kbd> saves without reaching for the mouse. Leaving with
            unsaved changes prompts for confirmation.
         </>
      ),
   },
   {
      title: "Save conditions on the version you opened",
      body: (
         <>
            Saving PUTs the new content back with the ETag you had open as a
            condition — the same conditional replacement path a manual re-upload
            uses. If the object changed after you opened it, the save is refused
            with a message to reload rather than overwriting someone else&apos;s
            write.
         </>
      ),
   },
   {
      title: "AWS CLI: download, edit, upload",
      body: (
         <>
            No shortcut here — copy the object down, edit it locally, and copy
            it back. Check the ETag before and after if you want the same
            protection S3 Viewer gives you automatically.
         </>
      ),
      code: `aws s3 cp s3://my-bucket/config/settings.json ./settings.json
$EDITOR ./settings.json
aws s3 cp ./settings.json s3://my-bucket/config/settings.json`,
   },
   {
      title: "AWS SDK: getObject, transform, conditional putObject",
      body: (
         <>
            Read the body, make your change, and write it back with{" "}
            <code>IfMatch</code> set to the ETag you read — this is the scripted
            version of what S3 Viewer&apos;s Edit does under the hood.
         </>
      ),
      code: `const { Body, ETag } = await s3.getObject({ Bucket: 'my-bucket', Key: 'config/settings.json' });
const text = await Body.transformToString();
const updated = JSON.stringify({ ...JSON.parse(text), debug: false });

await s3.putObject({
  Bucket: 'my-bucket',
  Key: 'config/settings.json',
  Body: updated,
  IfMatch: ETag,
});`,
   },
   {
      title: "Large or binary files: edit locally instead",
      body: (
         <>
            An in-browser editor only makes sense for small text — S3 Viewer
            caps it at 1 MB, and a multi-megabyte log or a binary file
            wouldn&apos;t render usefully as a textarea anyway. Download, edit
            with the right tool, and re-upload for anything past that line.
         </>
      ),
   },
];

const faqs: Faq[] = [
   {
      question: "Can I edit a file directly in S3?",
      answer:
         "Not literally — S3 has no in-place edit call. What every tool that offers 'editing' actually does is read the full object, apply the change, and write the full object back with PutObject. For small text files this round trip is fast enough that it feels like an edit. S3 Viewer's Edit button does exactly this for text-like files up to 1 MB, directly in the browser.",
   },
   {
      question: "What file types can S3 Viewer edit in place?",
      answer:
         "Text-like content types and extensions: JSON, TXT, MD, CSV, YAML/YML, XML, HTML, CSS, JS, TS, SH, ENV, TOML, INI, LOG and SVG, up to 1 MB. Anything larger, or a binary format, opens for preview only — download, edit locally, and re-upload instead.",
   },
   {
      question: "Will I lose my changes if someone else edits the file first?",
      answer:
         "No — the save carries the ETag of the version you opened as a condition, so if the object changed in the meantime the save is refused with a message to reload, rather than silently overwriting the other change. This is the same protection S3 Viewer's upload replacement flow uses everywhere else.",
   },
   {
      question:
         "How do I edit a JSON or config file in an S3 bucket from the terminal?",
      answer:
         "aws s3 cp it down, edit with your usual editor, then aws s3 cp it back up to the same key. Pass --if-match with the object's ETag on the way back if you're scripting this and want to guard against a concurrent change, since the AWS CLI doesn't do that for you automatically.",
   },
   {
      question: "Does editing a file in S3 create a new version?",
      answer:
         "Only if the bucket has versioning enabled — then the PutObject that saves your change creates a new version and the previous content remains recoverable. Without versioning, the save overwrites the object outright and the prior content is gone once it succeeds.",
   },
   {
      question:
         "Can I edit a file in Cloudflare R2 or Backblaze B2 the same way?",
      answer:
         "Yes. Saving an edit is a conditional PutObject, which S3 Viewer already runs on every connected provider for replacements — R2 and B2 included, using a HEAD-and-compare check on the providers that don't enforce the condition themselves rather than trusting a header they might ignore.",
   },
];

export default createHowToPage({
   slug: SLUG,
   tldr: TLDR,
   seoTitle: "Edit a File in S3 Without Downloading It First",
   seoDescription:
      "S3 has no edit API. Here's the read-change-write pattern behind editing a small text file in S3, and how S3 Viewer does it in the browser.",
   published: "2026-09-07",
   updated: "2026-10-12",
   visual: <SearchIllustration />,
   steps,
   underTheHood: (
      <>
         <p>
            S3&apos;s object API has exactly two operations that touch content:{" "}
            <code>GetObject</code> reads the whole body, and{" "}
            <code>PutObject</code> replaces it whole. There is nothing between
            them — no patch, no append, no byte-range write. Editing a file is
            therefore always: read everything, change what you want, write
            everything back.
         </p>
         <p>
            S3 Viewer&apos;s Edit button runs that loop for you: it HEADs the
            object first (refusing anything over 1 MB before a byte transfers),
            streams the body into a plain-text editor with the object&apos;s
            ETag captured alongside it, and on save PUTs the new content back
            through the same route a manual replacement upload uses —{" "}
            <code>expectedETag</code> included, so a change made elsewhere
            between opening and saving is caught as a conflict rather than
            silently discarded.
         </p>
         <p>
            The 1 MB ceiling isn&apos;t arbitrary caution: a textarea holding a
            multi-megabyte file is a poor editor regardless of how fast the
            network is, and the file is more likely binary or log-shaped at that
            size anyway. Nothing about the underlying read-and-write pattern
            actually changes past that point — only the UI stops being the right
            tool for it.
         </p>
      </>
   ),
   faqs,
   useCases: ["s3-browser", "cloudflare-r2"],
   related: [
      "edit-s3-object-metadata",
      "upload-large-files-to-s3",
      "rename-s3-file",
   ],
});
