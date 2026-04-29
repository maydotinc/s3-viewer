import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { getRelatedHowTos } from "@/components/HowTo/data";
import { getRelated } from "@/components/UseCases/data";
import { SecurityIllustration } from "@/components/UseCases/illustrations";
import { buildUseCaseJsonLd } from "@/components/UseCases/jsonld";
import UseCasePage, {
   type UseCaseFAQ,
   type UseCaseStep,
} from "@/components/UseCases/use-case-page";
import { SITE_URL } from "@/lib/site-config";
import {
   ClipboardList,
   Database,
   FolderLock,
   KeyRound,
   Server,
   UserMinus,
} from "lucide-react";

const SLUG = "security-and-audit";
const TITLE = "Built so security teams sign off.";
const KEYWORD = "secure S3 access management";
const DESCRIPTION =
   "S3 Viewer encrypts your credentials at rest, logs every action, and never stores your objects. Designed for teams that have to answer 'is this safe?'";

const steps: UseCaseStep[] = [
   {
      title: "Connect with least-privilege keys",
      body: "Use IAM policies scoped to the buckets and prefixes you want to expose. Example policies are in the docs.",
   },
   {
      title: "Invite the team",
      body: "Each user gets their own scoped role. Revoke them in one click without rotating any AWS keys.",
   },
   {
      title: "Review the log",
      body: "Export audit events as CSV or JSON for compliance reviews and quarterly access audits.",
   },
];

const faqs: UseCaseFAQ[] = [
   {
      question: "Where are my AWS credentials stored?",
      answer:
         "Encrypted at rest using per-workspace keys. They're decrypted in memory only when signing an S3 request, then discarded. On self-host, you control the encryption key.",
   },
   {
      question: "Do you store the contents of my S3 objects?",
      answer:
         "No. Files stream from your bucket through our server to your browser. Nothing is persisted on our side.",
   },
   {
      question: "Is there an audit log I can export for compliance?",
      answer:
         "Yes. Every action — view, download, upload, rename, delete, invite, revoke — is logged with user, timestamp, IP, bucket, and key. Exportable as CSV or JSON.",
   },
   {
      question: "Can I run S3 Viewer entirely inside my own infrastructure?",
      answer:
         "Yes. The repo is open source and MIT-licensed. Self-host it behind your VPN and credentials never leave your network.",
   },
   {
      question: "What IAM policy should I use?",
      answer:
         "A least-privilege policy scoped to the specific buckets and prefixes you want to expose, with s3:GetObject, s3:PutObject, s3:DeleteObject, and s3:ListBucket. Example policies are in the docs.",
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
            title="Secure S3 Access With Audit Log and Encrypted Credentials"
            description={DESCRIPTION}
            canonical={`/use-cases/${SLUG}`}
            jsonLd={jsonLd}
         />
         <UseCasePage
            visual={<SecurityIllustration />}
            eyebrow="Security & audit"
            title={TITLE}
            subtitle={DESCRIPTION}
            description="The page you can send to your security review."
            bullets={[
               "Credentials encrypted at rest with per-workspace keys",
               "Full audit log of every read, upload, rename, and delete",
               "We never store object contents — files stream through, not into, our servers",
            ]}
            features={[
               {
                  icon: KeyRound,
                  title: "Encrypted credentials",
                  body: "Access keys are encrypted at rest; only decrypted in-memory to sign requests.",
               },
               {
                  icon: Database,
                  title: "No object storage",
                  body: "Files stream from your bucket to your browser. We don't keep them.",
               },
               {
                  icon: ClipboardList,
                  title: "Audit log",
                  body: "Every action recorded with user, IP, timestamp, bucket, and key.",
               },
               {
                  icon: FolderLock,
                  title: "Granular scopes",
                  body: "Per-bucket and per-prefix permissions per user.",
               },
               {
                  icon: UserMinus,
                  title: "Revocation",
                  body: "Remove a user without rotating IAM keys. Their session ends on next request.",
               },
               {
                  icon: Server,
                  title: "Self-host",
                  body: "Run the open-source build inside your network for full control.",
               },
            ]}
            steps={steps}
            faqs={faqs}
            relatedHowTos={getRelatedHowTos([
               "set-granular-s3-permissions",
               "invite-teammate-to-s3-bucket",
               "delete-file-from-s3",
            ])}
            related={getRelated(SLUG)}
         />
      </>
   );
};

Page.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default Page;
