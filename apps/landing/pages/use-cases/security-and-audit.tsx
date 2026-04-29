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
   "S3 Viewer is designed to be the kind of tool that doesn't add new attack surface. Credentials are encrypted at rest with RSA-4096. Object contents stream through, never persisted. No per-person IAM users to rotate at off-boarding. MIT-licensed and self-hostable inside your own VPC.";

const steps: UseCaseStep[] = [
   {
      title: "Connect with least-privilege keys",
      body: "Use an IAM policy scoped to the buckets and operations you actually need — typically s3:ListBucket, s3:GetObject, s3:PutObject, and s3:DeleteObject on specific bucket ARNs. If your token can't ListBuckets, pin an allowed-buckets whitelist when you connect.",
   },
   {
      title: "Invite the team — no IAM users to mint",
      body: "Each member gets their own login and role per bucket. Off-boarding is a one-click revoke; you don't rotate any AWS keys because they never had any.",
   },
   {
      title: "Self-host if compliance demands it",
      body: "Drop the open-source build inside your VPC. Credentials, sessions, and request signing all stay on your infrastructure. No third party in the request path.",
   },
];

const faqs: UseCaseFAQ[] = [
   {
      question: "Where are my AWS credentials stored?",
      answer:
         "Encrypted at rest with RSA-4096 (PKCS1_OAEP, SHA-256). The keys are decrypted in memory only when signing an S3 request, then discarded. They never reach the browser, never appear in any API response, and never enter any log. On the self-hosted build, you control the encryption key entirely.",
   },
   {
      question: "Do you store the contents of my S3 objects?",
      answer:
         "No. Files stream from your bucket through the server to your browser using short-lived presigned URLs. There is no object cache, no object database, and no object storage on our side. Cross-cloud copies stream byte-for-byte from source to destination — not into anything we keep.",
   },
   {
      question: "How is this safer than minting IAM users for every teammate?",
      answer:
         "Per-person IAM users are permanent artifacts: keys to rotate, console access to manage, off-boarding to remember. Workspace members aren't IAM users — they're sessions tied to your single workspace credential. Revoking them ends their session immediately; no AWS keys to cycle, no policies to update, nothing for an attacker to lift from a stale config.",
   },
   {
      question: "Can I run S3 Viewer entirely inside my own infrastructure?",
      answer:
         "Yes. The repo is open source under the MIT license. Self-host it behind your VPN or inside your VPC and credentials, sessions, and traffic never leave your network. The encryption key is yours to manage.",
   },
   {
      question: "How do I off-board someone who's leaving?",
      answer:
         "Click revoke on their workspace membership. Their session ends on the next request and they can no longer authenticate. You don't have to rotate any AWS or R2 keys — they never held any. Other teammates and applications keep working.",
   },
   {
      question: "What IAM policy should I use?",
      answer:
         "A least-privilege policy scoped to the buckets you want to expose, typically with s3:GetObject, s3:PutObject, s3:DeleteObject, and s3:ListBucket. For listing inside a specific prefix only, add a Condition on s3:prefix. The IAM-permissions how-to has a full example policy.",
   },
   {
      question: "Is the source code open?",
      answer:
         "Yes. S3 Viewer is MIT-licensed and the source is on GitHub. Audit the encryption code, the request signing path, and the access checks for yourself. Fork it, contribute, or self-host without paying anyone.",
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
            title="Secure S3 Access — RSA-4096 Encrypted Keys, MIT Open Source"
            description={DESCRIPTION}
            canonical={`/use-cases/${SLUG}`}
            jsonLd={jsonLd}
         />
         <UseCasePage
            visual={<SecurityIllustration />}
            eyebrow="Security"
            title={TITLE}
            subtitle={DESCRIPTION}
            description="A tool you can hand to your security review."
            bullets={[
               "RSA-4096 encrypted credentials — decrypted only in memory",
               "Zero object retention — nothing persisted on our side",
               "MIT-licensed and self-hostable inside your VPC",
            ]}
            features={[
               {
                  icon: KeyRound,
                  title: "RSA-4096 encrypted credentials",
                  body: "Access keys are encrypted at rest with RSA-4096 (PKCS1_OAEP, SHA-256). Decrypted only in memory to sign requests, then discarded. They never reach the browser, never appear in logs, never return in API responses.",
               },
               {
                  icon: Database,
                  title: "Zero object retention",
                  body: "Files stream from your bucket to the browser via short-lived presigned URLs. No object cache, no object database, no object storage. Cross-cloud copies stream source-to-destination, not into anything we keep.",
               },
               {
                  icon: Lock,
                  title: "No IAM users to rotate",
                  body: "Workspace members aren't IAM users — they're sessions tied to your single workspace credential. Off-boarding is a session revoke. Nothing permanent for attackers to lift, nothing for you to forget about.",
               },
               {
                  icon: UserMinus,
                  title: "Revoke without key rotation",
                  body: "Pulling a user's access ends their session immediately. No AWS keys to cycle, no policies to edit, no other teammates affected, no applications broken.",
               },
               {
                  icon: Server,
                  title: "Self-host on your VPC",
                  body: "MIT-licensed. Self-host with PostgreSQL, your own OpenSSL keys, and HTTPS — credentials never have to leave your network.",
               },
               {
                  icon: Github,
                  title: "Open and auditable",
                  body: "The full source is on GitHub. Read the encryption code, the request signing path, and the access checks for yourself before you trust it.",
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
