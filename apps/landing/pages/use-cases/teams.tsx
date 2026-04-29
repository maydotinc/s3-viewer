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
   ClipboardList,
   FolderLock,
   KeyRound,
   ShieldCheck,
   UserPlus,
   Users,
} from "lucide-react";

const SLUG = "teams";
const TITLE = "A workspace for your team's buckets.";
const KEYWORD = "S3 bucket team access";
const DESCRIPTION =
   "Give your team S3 bucket access without handing out root credentials. Invite teammates, scope them to a bucket or prefix, and revoke them in one click.";

const steps: UseCaseStep[] = [
   {
      title: "Create a workspace",
      body: "One per team or project. Connect your buckets to it once with a single set of credentials.",
   },
   {
      title: "Invite teammates",
      body: "Pick a role (viewer, editor, admin) and optionally a prefix scope. Send by email.",
   },
   {
      title: "Watch the audit log",
      body: "Every view, download, upload, rename, and delete is recorded with user and timestamp.",
   },
];

const faqs: UseCaseFAQ[] = [
   {
      question:
         "How do I give my team access to an S3 bucket without creating IAM users for each of them?",
      answer:
         "Connect the bucket to an S3 Viewer workspace once using a single set of credentials, then invite teammates by email. They authenticate against the workspace, not AWS, so you never create per-person IAM users.",
   },
   {
      question: "Can I limit a teammate to one folder in a bucket?",
      answer:
         "Yes. Set a prefix scope on their invite (for example reports/finance/). They cannot list or read anything outside that prefix.",
   },
   {
      question: "What roles are available?",
      answer:
         "Three: viewer (read and download), editor (read, upload, rename, delete), and admin (everything plus invite/remove users and connect buckets).",
   },
   {
      question: "Is there an audit log?",
      answer:
         "Yes. Every action — view, download, upload, rename, delete — is logged with the user, timestamp, bucket, and key. Exportable as JSON or CSV.",
   },
   {
      question: "Can I use SSO?",
      answer:
         "Google SSO is available on hosted. SAML and OIDC are available on the self-hosted build.",
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
            title="Team Access for S3 Buckets — Invite, Scope, Revoke"
            description={DESCRIPTION}
            canonical={`/use-cases/${SLUG}`}
            jsonLd={jsonLd}
         />
         <UseCasePage
            visual={<TeamsIllustration />}
            eyebrow="Team workspaces"
            title={TITLE}
            subtitle={DESCRIPTION}
            description="Built so onboarding a teammate doesn't mean another IAM user."
            bullets={[
               "One workspace, multiple connected buckets, multiple teammates",
               "Per-user roles: admin, editor, viewer",
               "Per-prefix scopes for fine-grained access",
            ]}
            features={[
               {
                  icon: KeyRound,
                  title: "Workspace credentials",
                  body: "Connect a bucket once; the whole team uses it.",
               },
               {
                  icon: Users,
                  title: "Roles",
                  body: "Admin, editor, viewer — clear and minimal.",
               },
               {
                  icon: FolderLock,
                  title: "Prefix scopes",
                  body: "Restrict a user to logs/2026/ and nothing else.",
               },
               {
                  icon: ClipboardList,
                  title: "Audit log",
                  body: "Every action recorded with user and timestamp. Exportable.",
               },
               {
                  icon: ShieldCheck,
                  title: "SSO-ready",
                  body: "Google SSO on hosted; SAML and OIDC on self-host.",
               },
               {
                  icon: UserPlus,
                  title: "No new IAM users",
                  body: "Onboard a teammate without touching AWS.",
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
