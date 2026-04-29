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
   Database,
   Github,
   KeyRound,
   Lock,
   Server,
   UserMinus,
} from "lucide-react";

const SLUG = "security-and-audit";
const TITLE = "Built so security teams sign off.";
const KEYWORD = "secure S3 access management";
const DESCRIPTION =
   "S3 Viewer encrypts your S3 credentials at rest with RSA-4096, never stores object contents, and is fully open source under MIT. Self-host the same UI inside your own VPC for zero-trust access management.";

const steps: UseCaseStep[] = [
   {
      title: "Connect with least-privilege keys",
      body: "Use an IAM policy scoped to the buckets and operations you actually need — typically s3:ListBucket, s3:GetObject, s3:PutObject, and s3:DeleteObject on specific bucket ARNs.",
   },
   {
      title: "Invite the team",
      body: "Each user gets their own login and role per bucket. Revoke them in one click without rotating any AWS keys — because they never had any.",
   },
   {
      title: "Self-host if you have to",
      body: "Drop the open-source build inside your VPC. Credentials, sessions, and traffic all stay on your infrastructure. No third party in the request path.",
   },
];

const faqs: UseCaseFAQ[] = [
   {
      question: "Where are my AWS credentials stored?",
      answer:
         "Encrypted at rest with RSA-4096 (PKCS1_OAEP, SHA-256). The keys are decrypted in memory only when signing an S3 request, then discarded. On the self-hosted build, you control the encryption key entirely.",
   },
   {
      question: "Do you store the contents of my S3 objects?",
      answer:
         "No. Files stream from your bucket through the server to your browser using short-lived presigned URLs. Nothing is persisted on the server side — there is no object cache, no object database, and no object storage.",
   },
   {
      question: "Can I run S3 Viewer entirely inside my own infrastructure?",
      answer:
         "Yes. The repo is open source under the MIT license and ships with one-command deployment. Self-host it behind your VPN or inside your VPC and credentials, sessions, and traffic never leave your network.",
   },
   {
      question: "How do I off-board someone who's leaving?",
      answer:
         "Click revoke on their workspace membership. Their session ends on the next request and they can no longer authenticate. You don't have to rotate any AWS or R2 keys — because they never held any. Other teammates and applications keep working.",
   },
   {
      question: "What IAM policy should I use?",
      answer:
         "A least-privilege policy scoped to the buckets you want to expose, typically with s3:GetObject, s3:PutObject, s3:DeleteObject, and s3:ListBucket. For listing inside a specific prefix only, add a Condition on s3:prefix. The IAM-permissions how-to has a full example policy.",
   },
   {
      question: "Is the source code open?",
      answer:
         "Yes. S3 Viewer is MIT-licensed and the source is on GitHub. Audit it, fork it, contribute, or self-host without paying anyone.",
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
            title="Secure S3 Access Management — Encrypted Credentials, MIT Open Source"
            description={DESCRIPTION}
            canonical={`/use-cases/${SLUG}`}
            jsonLd={jsonLd}
         />
         <UseCasePage
            visual={<SecurityIllustration />}
            eyebrow="Security"
            title={TITLE}
            subtitle={DESCRIPTION}
            description="The page you can send to your security review."
            bullets={[
               "Credentials encrypted at rest with RSA-4096 — decrypted only in memory to sign requests",
               "Object contents stream through, not into, our servers — nothing is persisted",
               "MIT-licensed and self-hostable — run the same UI inside your VPC",
            ]}
            features={[
               {
                  icon: KeyRound,
                  title: "RSA-4096 encrypted credentials",
                  body: "Access keys are encrypted at rest with RSA-4096 (PKCS1_OAEP, SHA-256). They're only decrypted in memory to sign requests, then discarded.",
               },
               {
                  icon: Database,
                  title: "Zero object retention",
                  body: "Files stream from your bucket to your browser via short-lived presigned URLs. We don't cache, log, or persist object contents anywhere.",
               },
               {
                  icon: Lock,
                  title: "Per-bucket scoping",
                  body: "Members only see the buckets you granted them. Restrict by bucket; layer in IAM s3:prefix conditions when you need finer-grained access.",
               },
               {
                  icon: UserMinus,
                  title: "Revoke without key rotation",
                  body: "Pulling a user's access is a workspace action — their session ends, no AWS keys to cycle, no other teammates affected.",
               },
               {
                  icon: Server,
                  title: "Self-host on your VPC",
                  body: "MIT-licensed open source. One-command deploy with PostgreSQL, OpenSSL key generation, and HTTPS — credentials never have to leave your network.",
               },
               {
                  icon: Github,
                  title: "Open and auditable",
                  body: "The full source is on GitHub. No black box — read the encryption code, the request signing path, and the access checks for yourself.",
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
