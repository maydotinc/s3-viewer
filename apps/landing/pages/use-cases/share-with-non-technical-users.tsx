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
   Activity,
   Eye,
   Lock,
   Mail,
   ShieldCheck,
   UserMinus,
} from "lucide-react";

const SLUG = "share-with-non-technical-users";
const TITLE = "Let people view your S3 files without giving them AWS.";
const KEYWORD = "share S3 files with non-technical user";
const DESCRIPTION =
   "S3 Viewer lets you share S3 files with non-technical users — no IAM, no AWS console, no CLI. Just an email invite and a link.";

const steps: UseCaseStep[] = [
   {
      title: "Connect the bucket once",
      body: "Add your AWS or R2 credentials to a workspace. The bucket shows up in your sidebar.",
   },
   {
      title: "Invite the person",
      body: "Type their email, pick the bucket or prefix you want to expose, and set them to read-only.",
   },
   {
      title: "They open the link",
      body: "They sign in to S3 Viewer in a browser and see a clean file browser scoped to exactly what you shared.",
   },
];

const faqs: UseCaseFAQ[] = [
   {
      question:
         "How do I share an S3 file with someone who doesn't have an AWS account?",
      answer:
         "Invite them to an S3 Viewer workspace by email, scope their access to the bucket or prefix you want them to see, and send the link. They sign in to the web app and view files in a browser — they never touch AWS, IAM, or the CLI.",
   },
   {
      question: "Is this safer than a presigned URL?",
      answer:
         "For ongoing access, yes. Presigned URLs are bearer tokens — anyone who gets the link gets the file. S3 Viewer ties access to a logged-in user, lets you revoke instantly, and logs every download.",
   },
   {
      question: "Can I let someone view files but not delete or upload?",
      answer:
         "Yes. Each invited user has a role: viewer, editor, or admin. Viewers can browse and download but cannot upload, rename, or delete.",
   },
   {
      question: "Can the recipient see other files in my bucket?",
      answer:
         "Only files under the prefix you scoped them to. If you share clients/acme/, they cannot list or read anything outside that path.",
   },
   {
      question: "What happens when I revoke access?",
      answer:
         "Their session ends on next request and the workspace stops signing S3 calls for them. Unlike rotating an IAM key, nothing else breaks.",
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
            title="Share S3 Files With Non-Technical Users"
            description={DESCRIPTION}
            canonical={`/use-cases/${SLUG}`}
            jsonLd={jsonLd}
         />
         <UseCasePage
            visual={<ShareNonTechnicalIllustration />}
            eyebrow="Sharing without AWS"
            title={TITLE}
            subtitle={DESCRIPTION}
            description="The simplest way to put a file in someone else's hands."
            bullets={[
               "Invite by email; recipients view files in a browser",
               "Scope access to a single bucket or a single prefix",
               "Revoke any user instantly from a workspace dashboard",
            ]}
            features={[
               {
                  icon: Mail,
                  title: "Email invites",
                  body: "Send a link; the recipient signs in and sees only what you've shared.",
               },
               {
                  icon: ShieldCheck,
                  title: "No AWS account needed",
                  body: "Viewers never touch IAM, the console, or aws configure.",
               },
               {
                  icon: Lock,
                  title: "Prefix-scoped access",
                  body: "Share clients/acme/ without exposing the rest of the bucket.",
               },
               {
                  icon: Eye,
                  title: "Read-only mode",
                  body: "View and download only — uploads and deletes off by default.",
               },
               {
                  icon: Activity,
                  title: "Activity log",
                  body: "See who opened or downloaded which file.",
               },
               {
                  icon: UserMinus,
                  title: "Revoke in one click",
                  body: "Pull access without rotating keys.",
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
