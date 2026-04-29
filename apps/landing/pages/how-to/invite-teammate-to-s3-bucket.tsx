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
   "AWS IAM is powerful for service-to-service auth and fine-grained policy — but it's heavy for human collaboration on a single bucket. The simpler pattern: connect the bucket once with one least-privilege key, then invite teammates by email and assign per-bucket roles. S3 Viewer wraps that workflow — Owner, Admin, Editor, or Viewer per bucket, revocable in one click without rotating any AWS keys.";

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
            Paste an access key and secret. Use a least-privilege IAM
            user scoped to the buckets you want exposed — typically with{" "}
            <code>s3:ListBucket</code>, <code>s3:GetObject</code>,{" "}
            <code>s3:PutObject</code>, and <code>s3:DeleteObject</code>.
            Your whole team uses this one credential through their own
            logins.
         </>
      ),
   },
   {
      title: "Invite by email",
      body: (
         <>
            Type your teammate&apos;s email and pick a role per bucket:{" "}
            <strong>Viewer</strong> (read + download),{" "}
            <strong>Editor</strong> (read + upload + rename + delete),{" "}
            <strong>Admin</strong> (everything plus inviting other
            members), or <strong>Owner</strong> (full control). Same
            person can be Editor on one bucket and Viewer on another.
         </>
      ),
   },
   {
      title: "Send",
      body: (
         <>
            They get a link, sign in (email OTP or GitHub), and see only
            the buckets you assigned. They never touch AWS, IAM, or the
            CLI.
         </>
      ),
   },
   {
      title: "Off-boarding: one-click revoke",
      body: (
         <>
            Pull a member&apos;s workspace access. Their session ends on
            the next request and you don&apos;t need to rotate any AWS
            keys — they never had any.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "Can multiple users access the same S3 bucket without each having an IAM user?",
      answer:
         "Yes. Connect the bucket to an S3 Viewer workspace once with a single least-privilege IAM key, then invite teammates by email. They authenticate against the workspace, so you don't need per-person IAM users and you don't have to rotate access keys when someone leaves.",
   },
   {
      question: "Why use a workspace instead of per-person IAM?",
      answer:
         "AWS IAM is the right tool for many scenarios — service-to-service auth, fine-grained programmatic access, federated identity into the AWS console. For a small team that just needs to browse and share files in a bucket, IAM is heavier than it needs to be: a JSON policy per role, an access key per person, key rotation, off-boarding to remember. Workspace invites bundle that workflow into a session model — sign in, view buckets, revoke at off-boarding.",
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
      question: "How does this work with IAM Identity Center?",
      answer:
         "IAM Identity Center is the right tool for federating identity into AWS itself, including the AWS console — and it's a great choice for many enterprise scenarios. S3 Viewer is a complementary layer on top of S3 (and other S3-compatible providers) for the specific case of human collaboration on object storage. You can use both: Identity Center for federated AWS access, S3 Viewer for the browsing-and-sharing workflow.",
   },
   {
      question: "Does this work with Cloudflare R2 buckets too?",
      answer:
         "Yes. Connect an R2 bucket the same way and invite teammates to it. They never need a Cloudflare account — the workspace handles authentication.",
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
            title="How to Invite a Teammate to Your S3 Bucket (Without IAM Users)"
            description="Skip per-person IAM users for human collaboration. Connect the bucket to a workspace once, then invite teammates by email with per-bucket roles."
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
                  AWS IAM is built for service-to-service authorization
                  and fine-grained programmatic policy. For a small team
                  that just needs to browse and share files in a bucket,
                  per-person IAM is heavier than it needs to be: a JSON
                  policy per role, a key per person, rotation cycles, and
                  off-boarding to remember. S3 Viewer takes a different
                  approach for that human-collaboration case: the bucket
                  is connected once with a workspace-level credential,
                  and teammates authenticate to the workspace instead of
                  AWS. Their access is enforced server-side — the
                  workspace signs S3 requests on their behalf only for
                  buckets and roles they&apos;ve been granted. When you
                  revoke them, no keys need rotating because they never
                  held any. The same model works for Cloudflare R2 and
                  any other S3-compatible provider.
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
