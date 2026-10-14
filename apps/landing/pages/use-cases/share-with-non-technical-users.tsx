import { ShareNonTechnicalIllustration } from "@/components/UseCases/illustrations/use-cases/share-non-technical";
import {
   createUseCasePage,
   type UseCaseStep,
} from "@/components/UseCases/use-case-page";
import type { Faq } from "@/lib/types";
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
const META_DESCRIPTION =
   "Share an S3 file with someone who does not use AWS: a 15-minute presigned link for one-off access, or a revocable email invite for ongoing access.";
const DESCRIPTION =
   "Two ways to share an S3 file with someone who doesn't use AWS or Cloudflare: a 15-minute presigned link for one-off access, or an email invite for ongoing access. S3 Viewer makes both one click — and the invite is revocable, given a role, and tied to a logged-in user instead of a bearer link.";

const steps: UseCaseStep[] = [
   {
      title: "Connect the bucket once",
      body: "Click Add server and enter your AWS S3 or Cloudflare R2 credentials, region and endpoint. The buckets appear in your sidebar; the credentials are encrypted in your browser before they reach us.",
   },
   {
      title: "Invite by email",
      body: "Click Invite above the bucket list, or open Settings, Invites. Type the recipient's email, pick the server and choose a role: Viewer (browse and download), Editor (also upload, rename, delete and create buckets where supported) or Admin (also manage members, rename the server and remove buckets). They get an emailed invite.",
   },
   {
      title: "They open it in any browser",
      body: "They sign in with an email and password, or with GitHub, accept the invite, and see exactly the buckets you shared. No AWS account, no IAM user, no Cloudflare account, nothing to install.",
   },
];

const faqs: Faq[] = [
   {
      question:
         "How do I share an S3 file with someone who doesn't have an AWS account?",
      answer:
         "Two ways. Quickest: open the ⋮ menu on the file in S3 Viewer and choose Copy link — a presigned URL good for 15 minutes, which works in any browser. Best for ongoing access: invite them by email from the Share dialog. They sign in to S3 Viewer in a browser, see only the buckets you shared, and never touch AWS, IAM, or the CLI.",
   },
   {
      question: "Is an email invite better than a presigned URL?",
      answer:
         "It depends on the use case. A presigned URL is the right tool for a one-off share — short-lived, no signup needed, works in any browser. An invite is the right tool for ongoing access: revocable in one click and tied to a specific signed-in user with a role. Presigned URLs are bearer tokens, so they can't be revoked once shared; invites can.",
   },
   {
      question: "Can I let someone view files but not delete or upload?",
      answer:
         "Yes. The Viewer role can browse and download but cannot upload, rename, or delete. Editors can upload, rename, delete and create buckets where supported; Admins can also manage members, rename the server and remove buckets from it; the Owner can also delete the server. Object rename and deletion work the same way on every connected provider, not just AWS S3. A bucket can override a member's server role, so the same person can be a Viewer on one bucket and an Editor on another.",
   },
   {
      question: "Can the recipient see other buckets on my server?",
      answer:
         "Only the ones the server exposes. When you add a server you can name exactly which buckets it may reach, and members never see anything outside that list.",
   },
   {
      question: "What happens when I remove someone?",
      answer:
         "They lose access to that server on their next request and S3 Viewer stops signing calls for them. Unlike rotating an IAM key, nothing else breaks — your other teammates and your applications keep working.",
   },
   {
      question: "How long can a presigned URL last?",
      answer:
         "AWS allows presigned URLs up to 7 days when signed with IAM user credentials, or up to the session length when signed with temporary credentials (typically 1 hour for STS). Shorter is safer. Every URL S3 Viewer issues lasts 15 minutes, which keeps the blast radius small.",
   },
   {
      question: "Can I do this with Cloudflare R2?",
      answer:
         "Yes. Add an R2 server and invite users to it. They never need a Cloudflare account — S3 Viewer authenticates them. R2 supports the same presigned URL pattern as AWS S3, so one-off shares work identically.",
   },
];

export default createUseCasePage({
   slug: SLUG,
   title: TITLE,
   description: DESCRIPTION,
   seoTitle: "Share S3 Files With Non-Technical Users, No IAM",
   seoDescription: META_DESCRIPTION,
   eyebrow: "Sharing without AWS",
   headline: "A clean browser view for clients, designers, and execs.",
   bullets: [
      "Email invite — recipients sign in to a clean file viewer in any browser",
      "Roles: Owner, Admin, Editor, Viewer — with per-bucket overrides",
      "Remove any member instantly — no IAM keys to rotate",
   ],
   visual: <ShareNonTechnicalIllustration />,
   features: [
      {
         icon: Mail,
         title: "Email invites",
         body: "Send an invite; the recipient signs in with an email and password, or with GitHub, and sees only the buckets you shared. No AWS account, no IAM user, no Cloudflare login, no setup.",
      },
      {
         icon: ShieldCheck,
         title: "Server-side request signing",
         body: "S3 Viewer checks the member's role and then signs the S3 call with the server's stored credentials. Your access keys never reach their browser; removing the member stops their requests immediately.",
      },
      {
         icon: Eye,
         title: "Read-only by default",
         body: "Viewers can browse and download but cannot upload, rename, or delete. Drop-in safe for clients, executives, lawyers, and external reviewers.",
      },
      {
         icon: LinkIcon,
         title: "Copy link for one-offs",
         body: "Need a single file with no signup? Copy link in the row's ⋮ menu gives you a presigned URL, signed server-side and valid for 15 minutes. Works in any browser; treat it as a bearer token.",
      },
      {
         icon: Lock,
         title: "Encrypted credentials",
         body: "Your AWS keys are encrypted in your browser before they reach us and decrypted in memory only to sign a request. Recipients never see them.",
      },
      {
         icon: UserMinus,
         title: "Remove in one click",
         body: "Pull access without rotating IAM keys. They lose access to that server, your other teammates keep working, your applications keep running.",
      },
   ],
   steps,
   faqs,
   relatedHowTos: [
      "share-s3-file-with-non-technical-user",
      "share-one-folder-in-s3-bucket",
      "invite-teammate-to-s3-bucket",
      "set-granular-s3-permissions",
   ],
});
