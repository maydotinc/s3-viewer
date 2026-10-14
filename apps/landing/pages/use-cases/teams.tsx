import { TeamsIllustration } from "@/components/UseCases/illustrations/use-cases/teams";
import {
   createUseCasePage,
   type UseCaseStep,
} from "@/components/UseCases/use-case-page";
import type { Faq } from "@/lib/types";
import { KeyRound, ListOrdered, Mail, ShieldCheck, Users } from "lucide-react";
import { GitHubMark } from "@/components/social-marks";

const SLUG = "teams";
const TITLE = "Team access without per-person IAM users.";
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
      title: "Click Invite, add emails, pick a role",
      body: "Four roles, each one adding to the last: Viewer, Editor, Admin, Owner. Object rename and deletion work the same way on every connected provider. A bucket can override a member's server role, so a teammate can be an Editor on one bucket and a Viewer on another, and a Viewer or Editor can be limited to specific folders in a bucket. Off-boarding is one click and zero key rotation.",
   },
];

const faqs: Faq[] = [
   {
      question:
         "How do I give my team access to an S3 bucket without creating IAM users for each of them?",
      answer:
         "Add the server once with a single least-privilege IAM key, then invite teammates by email from Settings, Invites. They authenticate against S3 Viewer, not AWS, so you never need per-person IAM users and you don't have to rotate access keys when someone leaves.",
   },
   {
      question: "What roles are available?",
      answer:
         "Four, cumulative: Viewer (browse and download), Editor (also upload, rename, delete and create buckets where supported), Admin (also manage members, rename the server and remove buckets), and Owner (also delete the server). Owner belongs to whoever created the server and is not assignable. Object rename and deletion work the same way on every connected provider. A bucket can override a member's server role, so a teammate can be an Editor on one bucket and a Viewer on another.",
   },
   {
      question: "Can I limit a teammate to one bucket out of many?",
      answer:
         "Yes. Owners see every bucket on a server; everyone else sees only the buckets you grant them when you invite them. Give a teammate one bucket and the others are never listed for them — not just hidden.",
   },
   {
      question: "Can I limit a teammate to one folder inside a bucket?",
      answer:
         "Yes. Give a Viewer or Editor access to specific folders, such as landing/, instead of the whole bucket. They can work inside those folders and can't open, list or copy anything else in it — useful for a contractor who should only touch one part of a shared bucket. S3 Viewer enforces the limit on its server; the stored credential still reaches the whole bucket, and members never hold it. Admins always get whole buckets.",
   },
   {
      question: "What happens when someone leaves the team?",
      answer:
         "Remove them in the members dialog. They lose access to that server on their next request, and you don't have to rotate any AWS or R2 access keys — because they never had any. A download link they already opened keeps working for up to 15 minutes.",
   },
   {
      question: "How does this compare to IAM Identity Center or per-user IAM?",
      answer:
         "AWS IAM and Identity Center support federated access to the AWS console. S3 Viewer focuses on team file access: four roles with per-bucket overrides and a browser for connected S3-compatible storage. Upload, rename and deletion all work the same way across every connected provider.",
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

export default createUseCasePage({
   slug: SLUG,
   title: TITLE,
   description: DESCRIPTION,
   seoTitle: "S3 Bucket Team Access — Email Invites, No IAM",
   seoDescription: META_DESCRIPTION,
   eyebrow: "Team access",
   headline: "Server access built for human collaboration on object storage.",
   bullets: [
      "Email invites instead of IAM users — no permanent artifacts to rotate",
      "Four cumulative roles: Owner, Admin, Editor, Viewer",
      "Off-boarding is one click — access ends on the next request",
   ],
   visual: <TeamsIllustration />,
   features: [
      {
         icon: KeyRound,
         title: "One credential per server",
         body: "Add a server once with a least-privilege IAM key. The whole team uses it through their own logins — no shared root keys, no per-person IAM users, no policy JSON to maintain.",
      },
      {
         icon: Users,
         title: "Four roles, down to the folder",
         body: "Viewer, Editor, Admin, Owner — each adds to the one before it. A bucket can give the same person a different role, and a Viewer or Editor can be limited to specific folders in it.",
      },
      {
         icon: Mail,
         title: "Invite by email",
         body: "Click Invite, type an address, pick a role, send. They sign in with an email and password, or with GitHub, accept, and the server appears in their sidebar.",
      },
      {
         icon: ShieldCheck,
         title: "Server-side enforcement",
         body: "Every request is checked against the member's role before S3 Viewer signs it with the server's stored credentials. Their browser never sees an access key, and the check happens before anything reaches AWS.",
      },
      {
         icon: ListOrdered,
         title: "Clean off-boarding",
         body: "Remove the member. They lose access to that server on the next request; a download link they already opened keeps working for up to 15 minutes. No IAM key rotation, no policy edits, no broken applications.",
      },
      {
         icon: GitHubMark,
         title: "Self-host on your VPC",
         body: "MIT-licensed open source. Run the same UI inside your own infrastructure — full data residency, full control, and no third party in the request path.",
      },
   ],
   steps,
   faqs,
   relatedHowTos: [
      "invite-teammate-to-s3-bucket",
      "set-granular-s3-permissions",
      "share-s3-file-with-non-technical-user",
   ],
});
