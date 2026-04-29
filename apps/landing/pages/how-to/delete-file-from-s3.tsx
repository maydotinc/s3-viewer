import { getRelatedHowTos } from "@/components/HowTo/data";
import HowToPage, {
   type HowToFAQ,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import { buildHowToJsonLd } from "@/components/HowTo/jsonld";
import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { getUseCaseRefs } from "@/components/UseCases/data";
import { DeleteIllustration } from "@/components/UseCases/illustrations";
import { SITE_URL } from "@/lib/site-config";

const SLUG = "delete-file-from-s3";
const TITLE = "How to delete a file from S3 safely";
const KEYWORD = "delete file from S3";
const TLDR =
   "Run aws s3 rm s3://bucket/key, or right-click → Delete in S3 Viewer. If versioning is on, this just adds a delete marker — the object still exists until you delete the version.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: right-click → Delete",
      body: (
         <>
            Multi-select to bulk delete. The confirmation shows the count
            and total size before it commits.
         </>
      ),
   },
   {
      title: "CLI: aws s3 rm",
      body: <>Single file or whole prefix.</>,
      code: "aws s3 rm s3://my-bucket/old-file.zip\naws s3 rm s3://my-bucket/old-prefix/ --recursive",
   },
   {
      title: "Check if versioning is on",
      body: (
         <>
            <code>aws s3 rm</code> on a versioned bucket only adds a delete
            marker — the prior version is still there (and still billed).
         </>
      ),
      code: "aws s3api get-bucket-versioning --bucket my-bucket",
   },
   {
      title: "To permanently delete: remove the version",
      body: <>You need to delete each version explicitly.</>,
      code:
         "aws s3api delete-object \\\n  --bucket my-bucket --key old-file.zip \\\n  --version-id <version-id>",
   },
   {
      title: "List all versions if you're not sure",
      body: <>Lists every version and delete marker.</>,
      code:
         "aws s3api list-object-versions \\\n  --bucket my-bucket --prefix old-file.zip",
   },
   {
      title: "Watch out for MFA Delete",
      body: (
         <>
            If MFA Delete is enabled on the bucket, you need an MFA token to
            delete versions. Plan accordingly.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "How do I delete a file from S3?",
      answer:
         "aws s3 rm s3://bucket/key, or right-click → Delete in S3 Viewer. For prefixes, aws s3 rm s3://bucket/prefix --recursive.",
   },
   {
      question: "Why does my deleted S3 file still appear?",
      answer:
         "Probably versioning. aws s3 rm adds a delete marker rather than purging — older versions are still there. Delete the specific version IDs to fully remove it.",
   },
   {
      question: "Can I undo a delete?",
      answer:
         "Only if versioning was enabled when you deleted. Remove the delete marker (or restore the prior version) to bring the object back.",
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
            title="How to Delete a File From S3 Safely"
            description="Versioning, delete markers, and MFA Delete — what aws s3 rm actually does, and how to fully purge an S3 object."
            canonical={`/how-to/${SLUG}`}
            jsonLd={jsonLd}
         />
         <HowToPage
            eyebrow={TITLE}
            title={TITLE}
            tldr={TLDR}
            visual={<DeleteIllustration />}
            steps={steps}
            underTheHood={
               <p>
                  On a non-versioned bucket, <code>DeleteObject</code>{" "}
                  removes the key immediately. On a versioned bucket, it
                  writes a <strong>delete marker</strong> — the object
                  becomes invisible to normal <code>GetObject</code> calls
                  but every prior version is still there (and still billed).
                  To actually purge, you delete each version explicitly. S3
                  Viewer shows version state in the UI and prompts you when
                  versioning is on.
               </p>
            }
            faqs={faqs}
            useCases={getUseCaseRefs(["s3-browser", "security-and-audit"])}
            related={getRelatedHowTos([
               "rename-s3-file",
               "set-granular-s3-permissions",
               "search-across-s3-buckets",
            ])}
         />
      </>
   );
};

Page.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default Page;
