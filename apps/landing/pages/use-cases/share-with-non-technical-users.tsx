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
const TITLE = "Share S3 files with people who don't have AWS.";
const KEYWORD = "share S3 files with non-technical user";
const DESCRIPTION =
   "S3 Viewer lets you share AWS S3 and Cloudflare R2 files with clients, designers, executives, and other non-technical users — no IAM, no AWS console, no CLI. Just an email invite or a presigned link.";

const steps: UseCaseStep[] = [
   {
      title: "Connect the bucket once",
      body: "Add your AWS S3 or Cloudflare R2 credentials to a workspace. The bucket appears in your sidebar; the credentials stay encrypted on the server.",
   },
   {
      title: "Invite by email",
      body: "Type the recipient's email, pick the bucket, and choose a role: Viewer (read + download), Editor (read + upload + delete), or Admin.",
   },
   {
      title: "They open the link in any browser",
      body: "They sign in to S3 Viewer in a browser and see exactly the bucket you shared — no AWS account, no IAM user, nothing to install.",
   },
];

const faqs: UseCaseFAQ[] = [
   {
      question: "How do I share an S3 file with someone who doesn't have an AWS account?",
      answer:
         "Two ways. Quickest: generate a presigned URL — a time-limited link that works in any browser. Best for ongoing access: invite them to an S3 Viewer workspace by email. They sign in to a clean browser-based file viewer scoped to the bucket you shared, and never touch AWS, IAM, or the CLI.",
   },
   {
      question: "Is a workspace invite safer than a presigned URL?",
      answer:
         "For ongoing access, yes. Presigned URLs are bearer tokens — anyone who gets the link can use it until it expires, and you can't revoke it once it's out. Workspace invites tie access to a specific signed-in user, can be revoked instantly, and don't leak if forwarded.",
   },
   {
      question: "Can I let someone view files but not delete or upload?",
      answer:
         "Yes. The Viewer role can browse and download but cannot upload, rename, or delete. Editors can upload and delete; Admins can manage members. Owners have full control.",
   },
   {
      question: "Can the recipient see other buckets in my workspace?",
      answer:
         "No. Members only see the buckets they've been invited to. If you have ten buckets connected and invite someone to one, they only see that one.",
   },
   {
      question: "What happens when I revoke access?",
      answer:
         "Their session ends on the next request and the workspace stops signing S3 calls for them. Unlike rotating an IAM key, nothing else breaks — your other teammates and your applications keep working.",
   },
   {
      question: "Can I do this with Cloudflare R2 instead of AWS S3?",
      answer:
         "Yes. Connect an R2 bucket the same way and invite users to it. They never need a Cloudflare account — the workspace authenticates them, not Cloudflare.",
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
            title="Share S3 Files With Non-Technical Users — No AWS Account Needed"
            description={DESCRIPTION}
            canonical={`/use-cases/${SLUG}`}
            jsonLd={jsonLd}
         />
         <UseCasePage
            visual={<ShareNonTechnicalIllustration />}
            eyebrow="Sharing without AWS"
            title={TITLE}
            subtitle={DESCRIPTION}
            description="Stop emailing zip files. Stop minting IAM users for clients."
            bullets={[
               "Invite by email — recipients view files in a browser, no AWS or Cloudflare account",
               "Pick a role per teammate: Viewer, Editor, or Admin",
               "Revoke any user instantly from the workspace dashboard",
            ]}
            features={[
               {
                  icon: Mail,
                  title: "Email invites",
                  body: "Send a link; the recipient signs in once and sees only the buckets you shared. No IAM users, no role policies, no AWS account creation.",
               },
               {
                  icon: ShieldCheck,
                  title: "No AWS or Cloudflare login",
                  body: "Recipients never see the AWS console, an IAM dashboard, or aws configure. The workspace is the front door.",
               },
               {
                  icon: Eye,
                  title: "Read-only by default",
                  body: "Viewers can browse and download but cannot upload, rename, or delete. Drop-in safe for clients, executives, and external reviewers.",
               },
               {
                  icon: LinkIcon,
                  title: "Presigned URLs for one-offs",
                  body: "Need to send a single file with no signup? Generate a time-limited link straight from the file menu — works in any browser.",
               },
               {
                  icon: Lock,
                  title: "Encrypted credentials",
                  body: "Your AWS keys are encrypted at rest with RSA-4096. Recipients never see them, and you never have to share them.",
               },
               {
                  icon: UserMinus,
                  title: "Revoke in one click",
                  body: "Pull access without rotating IAM keys. Their session ends, your other teammates and applications keep working.",
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
