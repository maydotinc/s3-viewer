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
const TITLE = "Team access without per-person IAM users.";
const KEYWORD = "S3 bucket team access";
const DESCRIPTION =
   "AWS IAM is built for service-to-service auth and fine-grained policy control — powerful, but heavy for human collaboration on a single bucket. S3 Viewer is a team workspace for AWS S3 and Cloudflare R2 that sits on top: connect a bucket once with one least-privilege key, invite teammates by email, assign per-bucket roles, and revoke without rotating anything.";

const steps: UseCaseStep[] = [
   {
      title: "Create a workspace",
      body: "One per team or project. Workspaces hold connected buckets and members; everything is scoped inside.",
   },
   {
      title: "Connect the bucket once",
      body: "Paste a single set of access keys — ideally a least-privilege IAM user scoped to the buckets you want exposed. Your whole team uses it through their own logins.",
   },
   {
      title: "Invite by email, assign a role per bucket",
      body: "Pick from four roles: Owner, Admin, Editor, Viewer. Roles are per bucket — a teammate can be an Editor on one and a Viewer on another. Off-boarding is one click and zero key rotation.",
   },
];

const faqs: UseCaseFAQ[] = [
   {
      question: "How do I give my team access to an S3 bucket without creating IAM users for each of them?",
      answer:
         "Connect the bucket to an S3 Viewer workspace once with a single least-privilege IAM key, then invite teammates by email. They authenticate against the workspace, not AWS, so you never need per-person IAM users and you don't have to rotate access keys when someone leaves.",
   },
   {
      question: "What roles are available?",
      answer:
         "Four: Viewer (read + download), Editor (read + upload + rename + delete), Admin (everything plus invite and remove members), and Owner (full control including bucket connections and billing). Roles are assigned per bucket — a teammate can be an Editor on one bucket and a Viewer on another in the same workspace.",
   },
   {
      question: "Can I limit a teammate to one bucket out of many?",
      answer:
         "Yes. Members only see the buckets you've granted them access to. Connect ten buckets to a workspace, give an engineer access to one, and the other nine are invisible to them — not just hidden, but not even listed.",
   },
   {
      question: "What happens when someone leaves the team?",
      answer:
         "Revoke their workspace access in one click. Their session ends on the next request, they can't sign back in, and you don't have to rotate any AWS or R2 access keys — because they never had any.",
   },
   {
      question: "How does this compare to IAM Identity Center or per-user IAM?",
      answer:
         "AWS IAM and Identity Center excel at federated identity into the AWS console — the right choice for many enterprise scenarios. S3 Viewer is built specifically for human collaboration on object storage: a simpler permission model (four roles, per bucket), a clean file browser for non-technical teammates, and one workspace UI that works the same on Cloudflare R2, MinIO, or any S3-compatible provider.",
   },
   {
      question: "Does this work with Cloudflare R2 buckets too?",
      answer:
         "Yes. Connect an R2 bucket the same way you'd connect an AWS bucket and invite teammates to it. They never need a Cloudflare account — the workspace handles authentication.",
   },
   {
      question: "Can teams be self-hosted?",
      answer:
         "Yes. S3 Viewer is MIT-licensed and the workspace UI runs the same way on your own infrastructure. Self-host inside your VPC for full data residency control.",
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
            title="S3 Bucket Team Access — Email Invites, Per-Bucket Roles, No IAM"
            description={DESCRIPTION}
            canonical={`/use-cases/${SLUG}`}
            jsonLd={jsonLd}
         />
         <UseCasePage
            visual={<TeamsIllustration />}
            eyebrow="Team workspaces"
            title={TITLE}
            subtitle={DESCRIPTION}
            description="A workspace built for human collaboration on object storage."
            bullets={[
               "Email invites instead of IAM users — no permanent artifacts to rotate",
               "Four per-bucket roles: Owner, Admin, Editor, Viewer",
               "Off-boarding is one click — sessions end on next request",
            ]}
            features={[
               {
                  icon: KeyRound,
                  title: "One credential per bucket",
                  body: "Connect a bucket once with a least-privilege IAM key. The whole team uses it through their own logins — no shared root keys, no per-person IAM users, no policy JSON to maintain.",
               },
               {
                  icon: Users,
                  title: "Four roles, per bucket",
                  body: "Owner, Admin, Editor, Viewer — clear and minimal. Same person, different roles on different buckets. The whole permission model fits in your head.",
               },
               {
                  icon: Mail,
                  title: "Invite by email",
                  body: "Type an address, pick a role, send. They sign in with email OTP or GitHub and the bucket appears in their sidebar.",
               },
               {
                  icon: ShieldCheck,
                  title: "Server-side enforcement",
                  body: "The workspace signs every S3 request on a member's behalf using your encrypted credentials. Their browser never sees an access key, and policy checks happen before requests reach AWS.",
               },
               {
                  icon: ListOrdered,
                  title: "Clean off-boarding",
                  body: "Click revoke. Session ends on next request. No IAM key rotation, no policy edits, no broken applications.",
               },
               {
                  icon: Github,
                  title: "Self-host on your VPC",
                  body: "MIT-licensed open source. Run the same workspace UI inside your own infrastructure — full data residency, full control, no third party in the request path.",
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
