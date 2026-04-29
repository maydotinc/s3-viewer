import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { getRelatedHowTos } from "@/components/HowTo/data";
import { getRelated } from "@/components/UseCases/data";
import { TeamsIllustration } from "@/components/UseCases/illustrations";
import { buildUseCaseJsonLd } from "@/components/UseCases/jsonld";
import UseCasePage, {
   type UseCaseFAQ,
   type UseCaseStep,
} from "@/components/UseCases/use-case-page";
import { SITE_URL } from "@/lib/site-config";
import {
   Github,
   KeyRound,
   ListOrdered,
   Mail,
   ShieldCheck,
   Users,
} from "lucide-react";

const SLUG = "teams";
const TITLE = "Give your team S3 access without minting IAM users.";
const KEYWORD = "S3 bucket team access";
const DESCRIPTION =
   "S3 Viewer is a team workspace for AWS S3 and Cloudflare R2 buckets. Connect a bucket once with workspace credentials, then invite teammates by email and assign per-bucket roles — no per-person IAM users, no key rotation when someone leaves.";

const steps: UseCaseStep[] = [
   {
      title: "Create a workspace",
      body: "One per team or project. Workspaces hold connected buckets and members; everything is scoped inside.",
   },
   {
      title: "Connect the bucket once",
      body: "Paste a single set of access keys — ideally a least-privilege IAM user scoped to the buckets you want to expose. Workspaces, not AWS, manage who can see what.",
   },
   {
      title: "Invite by email, assign a role",
      body: "Pick a role per teammate: Owner, Admin, Editor, or Viewer. Send the link. They sign in to the workspace, never to AWS or Cloudflare.",
   },
];

const faqs: UseCaseFAQ[] = [
   {
      question: "How do I give my team access to an S3 bucket without creating IAM users for each of them?",
      answer:
         "Connect the bucket to an S3 Viewer workspace once using a single set of credentials, then invite teammates by email. They authenticate against the workspace, not AWS, so you never create per-person IAM users and you don't have to rotate keys when someone leaves.",
   },
   {
      question: "What roles are available?",
      answer:
         "Four: Viewer (read + download), Editor (read + upload + rename + delete), Admin (everything plus invite and remove members), and Owner (full control including billing and bucket connections). Roles are assigned per bucket — a teammate can be an Editor on one bucket and a Viewer on another.",
   },
   {
      question: "Can I limit a teammate to one bucket out of many?",
      answer:
         "Yes. Members only see the buckets you've granted them access to. Connect ten buckets to a workspace, give an engineer access to one, and the other nine are invisible to them.",
   },
   {
      question: "What happens when someone leaves the team?",
      answer:
         "Revoke their workspace access in one click. Their session ends, they can't sign back in, and you don't have to rotate any AWS or R2 access keys — because they never had any.",
   },
   {
      question: "Why is this better than IAM Identity Center or per-user IAM?",
      answer:
         "IAM was designed for service-to-service auth, not human collaboration. Per-user IAM means rotating keys at offboarding, writing IAM policies for every bucket, and giving non-technical teammates a console they can't navigate. S3 Viewer keeps the bucket connection at the team level and gives each person a normal email login with a clean file browser.",
   },
   {
      question: "Does this work with Cloudflare R2 buckets too?",
      answer:
         "Yes. Connect an R2 bucket the same way you'd connect an AWS bucket and invite teammates to it. The workspace handles auth — Cloudflare never has to.",
   },
];

const Page = () => {
   const jsonLd = buildUseCaseJsonLd({
      slug: SLUG,
      title: `${TITLE} — S3 Viewer`,
      description: DESCRIPTION,
      siteUrl: SITE_URL,
      steps,
      faqs,
      keyword: KEYWORD,
   });

   return (
      <>
         <Seo
            title="S3 Bucket Team Access — Invite, Scope, Revoke Without IAM"
            description={DESCRIPTION}
            canonical={`/use-cases/${SLUG}`}
            jsonLd={jsonLd}
         />
         <UseCasePage
            visual={<TeamsIllustration />}
            eyebrow="Team workspaces"
            title={TITLE}
            subtitle={DESCRIPTION}
            description="Onboarding a teammate shouldn't mean writing another IAM policy."
            bullets={[
               "One workspace, multiple connected buckets, multiple teammates",
               "Per-bucket roles: Owner, Admin, Editor, Viewer",
               "Revoke without rotating keys — sessions end on next request",
            ]}
            features={[
               {
                  icon: KeyRound,
                  title: "One credential per bucket",
                  body: "Connect a bucket once with a single least-privilege IAM key. The whole team uses it through their own logins — no shared root keys, no per-person IAM users.",
               },
               {
                  icon: Users,
                  title: "Four roles, per bucket",
                  body: "Owner, Admin, Editor, Viewer — clear and minimal. Assign different roles to the same person on different buckets.",
               },
               {
                  icon: Mail,
                  title: "Invite by email",
                  body: "Type an address, pick a role, send. They sign in to the workspace and the bucket appears in their sidebar.",
               },
               {
                  icon: ShieldCheck,
                  title: "Server-side enforcement",
                  body: "The workspace signs every S3 request on a member's behalf. Their browser never sees your access keys, and policy checks happen before the request reaches AWS.",
               },
               {
                  icon: ListOrdered,
                  title: "Clean off-boarding",
                  body: "Click revoke. Their session dies on next request. No IAM key rotation, no policy edits, no broken applications.",
               },
               {
                  icon: Github,
                  title: "Self-host the same UI",
                  body: "MIT-licensed and open source. Run the same workspace inside your VPC for full control over data residency and SSO.",
               },
            ]}
            steps={steps}
            faqs={faqs}
            relatedHowTos={getRelatedHowTos([
               "invite-teammate-to-s3-bucket",
               "set-granular-s3-permissions",
               "share-s3-file-with-non-technical-user",
            ])}
            related={getRelated(SLUG)}
         />
      </>
   );
};

Page.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default Page;
