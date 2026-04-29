import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { getRelatedHowTos } from "@/components/HowTo/data";
import { getRelated } from "@/components/UseCases/data";
import { ShareNonTechnicalIllustration } from "@/components/UseCases/illustrations";
import { buildUseCaseJsonLd } from "@/components/UseCases/jsonld";
import UseCasePage, {
   type UseCaseFAQ,
   type UseCaseStep,
} from "@/components/UseCases/use-case-page";
import { SITE_URL } from "@/lib/site-config";
import {
   Eye,
   Link as LinkIcon,
   Lock,
   Mail,
   ShieldCheck,
   UserMinus,
} from "lucide-react";

const SLUG = "share-with-non-technical-users";
const TITLE = "Share S3 files without sharing AWS.";
const KEYWORD = "share S3 files with non-technical user";
const DESCRIPTION =
   "Two ways to share an S3 file with someone who doesn't use AWS or Cloudflare: a presigned URL for one-off access, or a workspace invite for ongoing access. S3 Viewer makes both one click — and the workspace invite is revocable, scoped per bucket, and tied to a logged-in user instead of a bearer link.";

const steps: UseCaseStep[] = [
   {
      title: "Connect the bucket once",
      body: "Add your AWS S3 or Cloudflare R2 credentials to a workspace. The bucket appears in your sidebar; the credentials stay encrypted on the server with RSA-4096.",
   },
   {
      title: "Invite by email",
      body: "Type the recipient's email, pick the bucket, choose a role: Viewer (read + download), Editor (read + upload + delete), or Admin. They get a sign-in link.",
   },
   {
      title: "They open it in any browser",
      body: "They sign in to S3 Viewer (email OTP or GitHub) and see exactly the bucket you shared — no AWS account, no IAM user, no Cloudflare account, nothing to install.",
   },
];

const faqs: UseCaseFAQ[] = [
   {
      question: "How do I share an S3 file with someone who doesn't have an AWS account?",
      answer:
         "Two ways. Quickest: right-click → Share link in S3 Viewer to generate a presigned URL — works in any browser, expires when you say. Best for ongoing access: invite them to a workspace by email. They sign in to S3 Viewer in a browser, see only the bucket you shared, and never touch AWS, IAM, or the CLI.",
   },
   {
      question: "Is a workspace invite better than a presigned URL?",
      answer:
         "It depends on the use case. A presigned URL is the right tool for a one-off share — short-lived, no signup needed, works in any browser. A workspace invite is the right tool for ongoing access: revocable in one click, tied to a specific signed-in user, and scoped per bucket. Presigned URLs are bearer tokens, so they can't be revoked once shared; workspace invites can.",
   },
   {
      question: "Can I let someone view files but not delete or upload?",
      answer:
         "Yes. The Viewer role can browse and download but cannot upload, rename, or delete. Editors can upload and delete; Admins can manage members. Owners have full control. Each role is assigned per bucket — same person can be a Viewer on one and an Editor on another.",
   },
   {
      question: "Can the recipient see other buckets in my workspace?",
      answer:
         "No. Members only see the buckets they've been invited to. If you have ten buckets connected and invite someone to one, the other nine are invisible to them.",
   },
   {
      question: "What happens when I revoke access?",
      answer:
         "Their session ends on the next request and the workspace stops signing S3 calls for them. Unlike rotating an IAM key, nothing else breaks — your other teammates and your applications keep working.",
   },
   {
      question: "How long can a presigned URL last?",
      answer:
         "AWS allows presigned URLs up to 7 days when signed with IAM user credentials, or up to the session length when signed with temporary credentials (typically 1 hour for STS). Shorter is safer. S3 Viewer issues 15-minute URLs for downloads to keep the blast radius small.",
   },
   {
      question: "Can I do this with Cloudflare R2?",
      answer:
         "Yes. Connect an R2 bucket and invite users to it. They never need a Cloudflare account — the workspace authenticates them. R2 supports the same presigned URL pattern as AWS S3, so one-off shares work identically.",
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
            title="Share S3 Files With Non-Technical Users — Email Invite, No IAM"
            description={DESCRIPTION}
            canonical={`/use-cases/${SLUG}`}
            jsonLd={jsonLd}
         />
         <UseCasePage
            visual={<ShareNonTechnicalIllustration />}
            eyebrow="Sharing without AWS"
            title={TITLE}
            subtitle={DESCRIPTION}
            description="A clean browser view for clients, designers, and execs."
            bullets={[
               "Email invite — recipients sign in to a clean file viewer in any browser",
               "Per-bucket roles: Viewer, Editor, Admin",
               "Revoke any user instantly — no IAM keys to rotate",
            ]}
            features={[
               {
                  icon: Mail,
                  title: "Email invites",
                  body: "Send a link; the recipient signs in (email OTP or GitHub) and sees only the buckets you shared. No AWS account, no IAM user, no Cloudflare login, no setup.",
               },
               {
                  icon: ShieldCheck,
                  title: "Server-side request signing",
                  body: "S3 Viewer signs every S3 call on the recipient's behalf using your encrypted credentials. Your access keys never reach the browser; revoking the user stops their requests immediately.",
               },
               {
                  icon: Eye,
                  title: "Read-only by default",
                  body: "Viewers can browse and download but cannot upload, rename, or delete. Drop-in safe for clients, executives, lawyers, and external reviewers.",
               },
               {
                  icon: LinkIcon,
                  title: "Presigned URLs for one-offs",
                  body: "Need a single file with no signup? Right-click → Share link generates a time-limited URL signed server-side. Works in any browser; treat as a bearer token.",
               },
               {
                  icon: Lock,
                  title: "Encrypted credentials",
                  body: "Your AWS keys are encrypted at rest with RSA-4096 (PKCS1_OAEP, SHA-256), decrypted only in memory to sign requests. Recipients never see them.",
               },
               {
                  icon: UserMinus,
                  title: "Revoke in one click",
                  body: "Pull access without rotating IAM keys. Their session ends, your other teammates keep working, your applications keep running.",
               },
            ]}
            steps={steps}
            faqs={faqs}
            relatedHowTos={getRelatedHowTos([
               "share-s3-file-with-non-technical-user",
               "invite-teammate-to-s3-bucket",
               "set-granular-s3-permissions",
            ])}
            related={getRelated(SLUG)}
         />
      </>
   );
};

Page.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default Page;
