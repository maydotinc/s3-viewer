import {
   createHowToPage,
   type HowToFAQ,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import { getRelatedHowTos } from "@/components/HowTo/data";
import { getUseCaseRefs } from "@/components/UseCases/data";
import { CreateFolderIllustration } from "@/components/UseCases/illustrations";

const SLUG = "create-folder-in-s3";
const TITLE = "How to create a folder in S3 (there are no folders)";
const KEYWORD = "create folder in S3";
const TLDR =
   "Amazon S3 has no folders. It is a flat key-value store, and a “folder” is just a shared key prefix that ends in a slash. The AWS console's Create folder button writes a zero-byte object whose key ends in /, and the CLI does the same with aws s3api put-object --key reports/2026/. You usually don't need either: upload an object to reports/2026/q3.pdf and the folder appears on its own in the console, the CLI and S3 Viewer, which lists every bucket with Delimiter=/ so each shared prefix shows as a folder. Cloudflare R2 and every other S3-compatible store behave the same way.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: upload into the path you want",
      body: (
         <>
            Open the bucket, then <strong>Upload → Upload folder</strong> and
            pick a directory, or drag a folder onto the listing. Every file is
            written under the current prefix plus its relative path, so{" "}
            <code>reports/2026/q3.pdf</code> creates the <code>2026/</code>{" "}
            folder as a side effect. There is no &ldquo;New folder&rdquo; button
            because an empty folder is not something S3 can hold; the folder
            exists the moment a key needs it, and S3 Viewer shows it right away.
         </>
      ),
   },
   {
      title: "AWS console: Create folder",
      body: (
         <>
            In the bucket&apos;s <strong>Objects</strong> tab choose{" "}
            <strong>Create folder</strong>, type a name and confirm. The console
            writes a zero-byte object whose key is the folder name plus a
            trailing slash, for example <code>reports/2026/</code>. That
            placeholder is what keeps an empty folder visible.
         </>
      ),
   },
   {
      title: "AWS CLI: put a zero-byte placeholder, or just copy a file into the path",
      body: (
         <>
            <code>aws s3api put-object</code> with a key ending in{" "}
            <code>/</code> is the exact equivalent of the console button. If the
            folder is about to receive files anyway, skip the placeholder and
            copy the first file to its full key. Note that{" "}
            <code>aws s3 cp --recursive</code> and <code>aws s3 sync</code> skip
            empty local directories, because there is nothing to upload.
         </>
      ),
      code: `# an "empty folder": a 0-byte object whose key ends in /
aws s3api put-object --bucket my-bucket --key reports/2026/

# or let the first upload create the prefix
aws s3 cp ./q3.pdf s3://my-bucket/reports/2026/q3.pdf`,
   },
   {
      title: "SDK: PutObject with an empty body",
      body: (
         <>
            Any SDK can write the placeholder. The trailing slash is the whole
            trick; nothing else marks the object as a folder. In Python:{" "}
            <code>
               s3.put_object(Bucket=&apos;my-bucket&apos;,
               Key=&apos;reports/2026/&apos;)
            </code>
            .
         </>
      ),
      code: `await s3.putObject({
  Bucket: 'my-bucket',
  Key: 'reports/2026/', // trailing slash = folder placeholder
  Body: '',
});`,
   },
   {
      title: "Verify with a delimited listing",
      body: (
         <>
            <code>aws s3 ls</code> lists with <code>Delimiter=/</code> and
            prints each shared prefix as <code>PRE</code>. This is the same{" "}
            <code>ListObjectsV2</code> call S3 Viewer makes, which is why both
            show the same folders.
         </>
      ),
      code: `aws s3 ls s3://my-bucket/reports/
#                            PRE 2025/
#                            PRE 2026/
# 2026-09-05 10:12:44      12034 index.csv`,
   },
   {
      title: "Know when a folder disappears",
      body: (
         <>
            Without a placeholder, deleting the last object under a prefix
            removes the folder from every listing, because nothing shares that
            prefix any more. With a placeholder the folder stays, and SDK
            listings show the <code>reports/2026/</code> key itself as a 0-byte
            object. S3 Viewer hides that key inside the folder it represents so
            the view stays clean.
         </>
      ),
   },
   {
      title: "Renaming or moving a folder means copying every key",
      body: (
         <>
            A folder is a prefix, so there is nothing to rename. Moving{" "}
            <code>reports/2026/</code> to <code>archive/2026/</code> means
            copying and deleting every object under it:{" "}
            <code>
               aws s3 mv s3://my-bucket/reports/2026/
               s3://my-bucket/archive/2026/ --recursive
            </code>
            . The same copy-then-delete pattern applies to a single object.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "Does Amazon S3 have folders?",
      answer:
         "No. S3 is a flat key-value store; every object lives in the bucket under a single key such as reports/2026/q3.pdf. Folders are a display convention: any tool that lists with Delimiter=/ groups keys by their shared prefix and shows each prefix as a folder. The AWS console, the AWS CLI and S3 Viewer all do this.",
   },
   {
      question: "How do I create an empty folder in S3?",
      answer:
         "Write a zero-byte object whose key ends in a slash, for example reports/2026/. The console's Create folder button does exactly this, as does aws s3api put-object --bucket my-bucket --key reports/2026/. The placeholder keeps the folder visible even when it contains no other objects.",
   },
   {
      question: "Why did my S3 folder disappear?",
      answer:
         "The folder had no placeholder object, and you deleted or moved the last object under its prefix. With nothing left to share the prefix, listings stop showing it. Create a zero-byte reports/2026/ object if you need the folder to survive being emptied.",
   },
   {
      question: "How do I create a folder in S3 with the AWS CLI?",
      answer:
         "Run aws s3api put-object --bucket my-bucket --key reports/2026/ to create a placeholder, or copy a file to the path you want (aws s3 cp ./file.pdf s3://my-bucket/reports/2026/file.pdf) and the folder appears on its own. aws s3 mb creates buckets, not folders.",
   },
   {
      question: "How do I create a folder in S3 with Python (boto3)?",
      answer:
         "Call s3.put_object(Bucket='my-bucket', Key='reports/2026/') with no Body. The trailing slash is what makes S3 tools treat the object as a folder. To create the folder implicitly, upload any object with that prefix, for example Key='reports/2026/q3.pdf'.",
   },
   {
      question: "Does creating a folder in S3 cost anything?",
      answer:
         "One PUT request, billed at the standard request rate (about $0.005 per 1,000 in most regions), and a zero-byte object with no meaningful storage cost. Creating the folder implicitly by uploading a file costs nothing beyond the upload itself.",
   },
   {
      question: "How do I create a folder in Cloudflare R2?",
      answer:
         "R2 implements the S3 API, so the same two approaches work: write a zero-byte object whose key ends in /, or upload an object into the path and let the prefix appear. In S3 Viewer, Upload folder works identically against an R2 bucket.",
   },
   {
      question: "How deep can S3 folders go?",
      answer:
         "As deep as the key allows. An S3 key can be up to 1,024 bytes of UTF-8, and every slash inside it is just another character, so a/b/c/d/e/file.txt is one key with five folder levels. Very deep prefixes only affect how many ListObjectsV2 calls a browser needs to walk down.",
   },
   {
      question: "How do I move files into a folder in S3?",
      answer:
         "Copy each object to its new key under the folder prefix and delete the original; S3 has no move or rename operation. aws s3 mv does both steps for you, and S3 Viewer's Rename action does the same for a single object, preserving metadata and tags.",
   },
];

export default createHowToPage({
   slug: SLUG,
   title: TITLE,
   tldr: TLDR,
   keyword: KEYWORD,
   seoTitle: "How to Create a Folder in S3 (Console, CLI, SDK, S3 Viewer)",
   seoDescription:
      "S3 has no folders, only key prefixes. Create one from the AWS console, the CLI, an SDK or S3 Viewer, and learn why an empty folder can vanish.",
   published: "2026-09-05",
   visual: <CreateFolderIllustration />,
   steps,
   underTheHood: (
      <>
         <p>
            S3 stores objects in a flat namespace. A key is an opaque string of
            up to 1,024 bytes, and the slash in <code>reports/2026/q3.pdf</code>{" "}
            means nothing to storage. It only matters to{" "}
            <strong>
               <code>ListObjectsV2</code>
            </strong>
            : pass <code>Prefix=reports/</code> and <code>Delimiter=/</code> and
            S3 rolls every key that continues past the next slash into a{" "}
            <code>CommonPrefixes</code> entry. Those entries are the folders you
            see. Keys that end at the current level come back in{" "}
            <code>Contents</code> as files.
         </p>
         <br />
         <p>
            The console&apos;s Create folder button exists because a listing can
            only show a prefix that at least one key shares. A zero-byte object
            named <code>reports/2026/</code> is that key: it shares the prefix
            with nothing else, so the folder shows up empty. S3 Viewer lists
            with the same <code>Prefix</code> and <code>Delimiter</code>{" "}
            parameters, pages through results 1,000 keys at a time, and drops
            the placeholder key from the view when you are inside the folder it
            stands for, so you see a folder rather than a folder plus a 0-byte
            file.
         </p>
         <br />
         <p>
            Two practical consequences. Prefixes are also the unit S3 uses to
            scale request rates (thousands of requests per second per prefix),
            so spreading hot objects across prefixes is a real performance
            technique. And because a folder is only a prefix, IAM conditions
            such as <code>s3:prefix</code> are how you grant access to &ldquo;a
            folder&rdquo; rather than a bucket.
         </p>
      </>
   ),
   faqs,
   useCases: getUseCaseRefs(["s3-browser", "cloudflare-r2"]),
   related: getRelatedHowTos([
      "rename-s3-file",
      "upload-large-files-to-s3",
      "set-granular-s3-permissions",
   ]),
});
