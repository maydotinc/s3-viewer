import { getRelatedHowTos } from "@/components/HowTo/data";
import HowToPage, {
   type HowToFAQ,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import { buildHowToJsonLd } from "@/components/HowTo/jsonld";
import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { getUseCaseRefs } from "@/components/UseCases/data";
import { InviteIllustration } from "@/components/UseCases/illustrations";
import { SITE_URL } from "@/lib/site-config";

const SLUG = "invite-teammate-to-s3-bucket";
const TITLE = "How to invite a teammate to your S3 bucket";
const KEYWORD = "invite teammate to S3 bucket";
const TLDR =
   "Don't create per-person IAM users. Connect the bucket to an S3 Viewer workspace once, then invite teammates by email and scope them to a bucket or prefix.";

const steps: HowToStep[] = [
   {
      title: "Create a workspace",
      body: <>One per team or project. Workspaces hold connections and members.</>,
   },
   {
      title: "Connect the bucket",
      body: (
         <>
            Paste an access key and secret. Use an IAM policy scoped to the
            buckets you want exposed — least privilege.
         </>
      ),
   },
   {
      title: "Invite by email",
      body: (
         <>
            Type their email and pick a role: viewer (read), editor (read +
            write), admin (everything).
         </>
      ),
   },
   {
      title: "Optionally scope to a prefix",
      body: (
         <>
            For example <code>reports/finance/</code>. They cannot list or
            read anything outside that prefix.
         </>
      ),
   },
   {
      title: "Send",
      body: (
         <>
            They get a link, sign in (Google or email), and see only the
            scope you assigned.
         </>
      ),
   },
   {
      title: "Audit and revoke",
      body: (
         <>
            Watch the audit log; remove a teammate in one click. No AWS keys
            to rotate.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question:
         "Can multiple users access the same S3 bucket without each having an IAM user?",
      answer:
         "Yes. Connect the bucket to an S3 Viewer workspace once; invite teammates by email. Their access is enforced by the workspace, not by IAM.",
   },
   {
      question: "How do I remove a teammate from a bucket?",
      answer:
         "Click revoke on their workspace membership. Their session ends; you don't need to rotate any AWS keys.",
   },
   {
      question: "Can I limit a teammate to one folder?",
      answer:
         "Yes — set a prefix scope on their role. They cannot list or read anything outside that prefix.",
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
            title="How to Invite a Teammate to Your S3 Bucket"
            description="Skip per-person IAM users. Connect the bucket to a workspace once, then invite teammates by email with prefix-scoped roles."
            canonical={`/how-to/${SLUG}`}
            jsonLd={jsonLd}
         />
         <HowToPage
            eyebrow={TITLE}
            title={TITLE}
            tldr={TLDR}
            visual={<InviteIllustration />}
            steps={steps}
            underTheHood={
               <p>
                  The standard AWS approach — one IAM user per teammate —
                  gets messy fast: keys to rotate, console access to manage,
                  off-boarding to remember. S3 Viewer flips it: the bucket is
                  connected once with a workspace-level credential, and
                  teammates authenticate to the workspace, not to AWS. Their
                  access is enforced server-side: the workspace signs S3
                  requests on their behalf only for paths inside their
                  assigned scope.
               </p>
            }
            faqs={faqs}
            useCases={getUseCaseRefs(["teams"])}
            related={getRelatedHowTos([
               "set-granular-s3-permissions",
               "share-s3-file-with-non-technical-user",
               "switch-between-s3-buckets",
            ])}
         />
      </>
   );
};

Page.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default Page;
