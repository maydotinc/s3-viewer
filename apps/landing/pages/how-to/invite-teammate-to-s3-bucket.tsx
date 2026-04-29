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
   "Don't mint a per-person IAM user for every teammate — it doesn't scale and you'll forget to off-board. Connect the bucket to an S3 Viewer workspace once with a single least-privilege key, then invite teammates by email and assign per-bucket roles.";

const steps: HowToStep[] = [
   {
      title: "Create a workspace",
      body: (
         <>
            One per team or project. Workspaces hold connected buckets and
            members; everything is scoped inside.
         </>
      ),
   },
   {
      title: "Connect the bucket once",
      body: (
         <>
            Paste an access key and secret. Use a least-privilege IAM user
            scoped to the buckets you want exposed — typically with{" "}
            <code>s3:ListBucket</code>, <code>s3:GetObject</code>,{" "}
            <code>s3:PutObject</code>, and <code>s3:DeleteObject</code>.
         </>
      ),
   },
   {
      title: "Invite by email",
      body: (
         <>
            Type your teammate&apos;s email and pick a role:{" "}
            <strong>Viewer</strong> (read + download),{" "}
            <strong>Editor</strong> (read + upload + rename + delete), or{" "}
            <strong>Admin</strong> (everything plus inviting other members).
         </>
      ),
   },
   {
      title: "Send",
      body: (
         <>
            They get a link, sign in, and see only the buckets you assigned
            to them. They never touch AWS, IAM, or the CLI.
         </>
      ),
   },
   {
      title: "Off-boarding: revoke in one click",
      body: (
         <>
            Pull a member&apos;s workspace access. Their session ends on the
            next request, and you don&apos;t need to rotate any AWS or R2
            keys — they never had any.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "Can multiple users access the same S3 bucket without each having an IAM user?",
      answer:
         "Yes. Connect the bucket to an S3 Viewer workspace once with a single least-privilege IAM key, then invite teammates by email. They authenticate against the workspace, not AWS, so you never create per-person IAM users and you don't have to rotate access keys when someone leaves.",
   },
   {
      question: "How do I remove a teammate from a bucket?",
      answer:
         "Click revoke on their workspace membership. Their session ends on the next request — no AWS keys to rotate, no policies to edit, no other teammates affected.",
   },
   {
      question: "Can a teammate have different access on different buckets?",
      answer:
         "Yes. Roles are assigned per bucket. The same person can be a Viewer on one bucket, an Editor on another, and have no access at all to the rest.",
   },
   {
      question: "Why not just use IAM Identity Center or per-user IAM?",
      answer:
         "IAM was designed for service-to-service auth, not human collaboration. Per-user IAM means writing a policy for every bucket, rotating keys at offboarding, and giving non-technical teammates a console they can't navigate. Workspace invites keep the bucket connection at the team level and give each person a normal email login with a clean file browser.",
   },
   {
      question: "Does this work with Cloudflare R2 buckets too?",
      answer:
         "Yes. Connect an R2 bucket the same way and invite teammates to it. They never need a Cloudflare account — the workspace authenticates them.",
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
            title="How to Invite a Teammate to Your S3 Bucket (Without IAM)"
            description="Skip per-person IAM users. Connect the bucket to a workspace once, then invite teammates by email with per-bucket roles."
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
                  requests on their behalf only for buckets they&apos;ve
                  been granted access to. When you revoke them, no keys need
                  rotating because they never held any.
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
