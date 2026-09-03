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
const META_DESCRIPTION =
   "Give your team access to an S3 bucket without per-person IAM users: one least-privilege key, email invites, four roles, and off-boarding in one click.";
const DESCRIPTION =
   "AWS IAM is built for service-to-service auth and fine-grained policy control — powerful, but heavy for human collaboration on a single bucket. S3 Viewer sits on top of AWS S3 and Cloudflare R2 instead: add the server once with one least-privilege key, invite teammates by email, give each of them a role, and remove them without rotating anything.";

const steps: UseCaseStep[] = [
   {
      title: "Add a server",
      body: "One set of credentials pointed at one S3-compatible endpoint. The server holds the buckets those credentials reach and the members you invite; everything is scoped inside it.",
   },
   {
      title: "Connect the bucket once",
      body: "Paste a single set of access keys — ideally a least-privilege IAM user scoped to the buckets you want exposed — plus the region and endpoint. Your whole team uses it through their own logins.",
   },
   {
      title: "Click Share, invite by email, pick a role",
      body: "Four roles, each one adding to the last: Viewer, Editor, Admin, Owner. A bucket can override a member's server role, so a teammate can be an Editor on one bucket and a Viewer on another. Off-boarding is one click and zero key rotation.",
   },
];

const faqs: UseCaseFAQ[] = [
   {
      question:
         "How do I give my team access to an S3 bucket without creating IAM users for each of them?",
      answer:
         "Add the server once with a single least-privilege IAM key, then invite teammates by email from the Share dialog. They authenticate against S3 Viewer, not AWS, so you never need per-person IAM users and you don't have to rotate access keys when someone leaves.",
   },
   {
      question: "What roles are available?",
      answer:
         "Four, cumulative: Viewer (browse and download), Editor (also upload, rename, delete and create buckets), Admin (also invite and remove members, rename the server and remove buckets from it), and Owner (also delete the server). Owner belongs to whoever created the server and is not assignable. A bucket can override a member's server role, so a teammate can be an Editor on one bucket and a Viewer on another.",
   },
   {
      question: "Can I limit a teammate to one bucket out of many?",
      answer:
         "Yes. When you add a server you can name exactly which buckets it may reach, and members never see anything outside that list — not just hidden, but never listed.",
   },
   {
      question: "What happens when someone leaves the team?",
      answer:
         "Remove them in the members dialog. They lose access to that server on their next request, and you don't have to rotate any AWS or R2 access keys — because they never had any.",
   },
   {
      question: "How does this compare to IAM Identity Center or per-user IAM?",
      answer:
         "AWS IAM and Identity Center excel at federated identity into the AWS console — the right choice for many enterprise scenarios. S3 Viewer is built specifically for human collaboration on object storage: a simpler permission model (four cumulative roles, with per-bucket overrides), a clean file browser for non-technical teammates, and one UI that works the same on Cloudflare R2, MinIO, or any S3-compatible provider.",
   },
   {
      question: "Does this work with Cloudflare R2 buckets too?",
      answer:
         "Yes. Add an R2 server the same way you'd add an AWS one and invite teammates to it. They never need a Cloudflare account — S3 Viewer handles authentication.",
   },
   {
      question: "Can teams be self-hosted?",
      answer:
         "Yes. S3 Viewer is MIT-licensed and members, invites and roles work the same way on your own infrastructure. Self-host inside your VPC for full data residency control.",
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
            description={META_DESCRIPTION}
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
               "Four cumulative roles: Owner, Admin, Editor, Viewer",
               "Off-boarding is one click — access ends on the next request",
            ]}
            features={[
               {
                  icon: KeyRound,
                  title: "One credential per server",
                  body: "Add a server once with a least-privilege IAM key. The whole team uses it through their own logins — no shared root keys, no per-person IAM users, no policy JSON to maintain.",
               },
               {
                  icon: Users,
                  title: "Four roles, overridable per bucket",
                  body: "Viewer, Editor, Admin, Owner — each adds to the one before it. A bucket can give the same person a different role. The whole permission model fits in your head.",
               },
               {
                  icon: Mail,
                  title: "Invite by email",
                  body: "Click Share, type an address, pick a role, send. They sign in with the code and sign-in link we email them (or with GitHub, if enabled), accept, and the server appears in their sidebar.",
               },
               {
                  icon: ShieldCheck,
                  title: "Server-side enforcement",
                  body: "Every request is checked against the member's role before S3 Viewer signs it with the server's stored credentials. Their browser never sees an access key, and the check happens before anything reaches AWS.",
               },
               {
                  icon: ListOrdered,
                  title: "Clean off-boarding",
                  body: "Remove the member. They lose access to that server on the next request. No IAM key rotation, no policy edits, no broken applications.",
               },
               {
                  icon: Github,
                  title: "Self-host on your VPC",
                  body: "MIT-licensed open source. Run the same UI inside your own infrastructure — full data residency, full control, and self-hosted there is no third party in the request path.",
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
