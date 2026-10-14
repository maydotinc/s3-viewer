import {
   createHowToPage,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import type { Faq } from "@/lib/types";
import { InviteIllustration } from "@/components/UseCases/illustrations/how-to/invite";

const SLUG = "invite-teammate-to-s3-bucket";
const TLDR =
   "AWS IAM is powerful for service-to-service auth and fine-grained policy — but it's heavy for human collaboration on a single bucket. The simpler pattern: add the server once with one least-privilege key, then invite teammates by email and give each of them a role. S3 Viewer wraps that workflow — Owner, Admin, Editor or Viewer, with per-bucket overrides — and removing someone takes one click and no key rotation.";

const steps: HowToStep[] = [
   {
      title: "Add a server",
      body: (
         <>
            Click <strong>Add server</strong> in the sidebar. A server is one
            set of credentials pointed at one S3-compatible endpoint; it holds
            the buckets it can reach and the members you invite.
         </>
      ),
   },
   {
      title: "Connect the bucket once",
      body: (
         <>
            Paste an access key and secret. Use a least-privilege IAM user
            scoped to the buckets you want exposed — typically with{" "}
            <code>s3:ListBucket</code>, <code>s3:GetObject</code>,{" "}
            <code>s3:PutObject</code>, and <code>s3:DeleteObject</code>. Your
            whole team uses this one credential through their own logins.
         </>
      ),
   },
   {
      title: "Invite by email",
      body: (
         <>
            Click <strong>Invite</strong> above the bucket list, or open{" "}
            <strong>Settings, Members</strong>. Type your teammate&apos;s email,
            pick the servers to share, then a role on each:{" "}
            <strong>Viewer</strong> (browse and download),{" "}
            <strong>Editor</strong> (also upload, rename, delete, and create
            buckets where supported) or <strong>Admin</strong> (also manage
            members, rename the server and remove buckets).{" "}
            <strong>Owner</strong> is not in the picker — it belongs to whoever
            created the server, and only an Owner can delete it. A bucket can
            give someone a different role than they have on the server, so the
            same person can be an Editor on one bucket and a Viewer on another.
            To share only part of a bucket, switch it from <em>Whole bucket</em>{" "}
            to <em>Specific folders</em> and add the folders a Viewer or Editor
            should reach, such as <code>landing/</code>.
         </>
      ),
   },
   {
      title: "Send",
      body: (
         <>
            You can send up to <strong>five addresses at a time</strong>, and an
            invite is good for <strong>seven days</strong>. Each recipient gets
            one email; they sign in with an email and password (or with GitHub),
            accept, and the server appears in their sidebar — no AWS, no IAM, no
            CLI.
         </>
      ),
   },
   {
      title: "Off-boarding: remove the member",
      body: (
         <>
            Remove them under <strong>Settings, Members</strong>. They lose
            access to that server on their next request and you don&apos;t need
            to rotate any AWS keys — they never had any. A download link they
            already opened keeps working for up to 15 minutes.
         </>
      ),
   },
];

const faqs: Faq[] = [
   {
      question:
         "Can multiple users access the same S3 bucket without each having an IAM user?",
      answer:
         "Yes. Add the bucket's server to S3 Viewer once with a single least-privilege IAM key, then invite teammates by email — up to five addresses at a time, each invite valid for seven days. They authenticate against S3 Viewer, so you don't need per-person IAM users and you don't have to rotate access keys when someone leaves.",
   },
   {
      question: "Why use a shared server instead of per-person IAM?",
      answer:
         "AWS IAM is the right tool for many scenarios — service-to-service auth, fine-grained programmatic access, federated identity into the AWS console. For a small team that just needs to browse and share files in a bucket, IAM is heavier than it needs to be: a JSON policy per role, an access key per person, key rotation, off-boarding to remember. Email invites bundle that workflow into a session model — sign in, browse the buckets you were given, get removed at off-boarding.",
   },
   {
      question: "How do I remove a teammate from a bucket?",
      answer:
         "Remove them in the members dialog. They lose access to that server on their next request — no AWS keys to rotate, no policies to edit, no other teammates affected. A download link they already opened keeps working for up to 15 minutes.",
   },
   {
      question: "Can a teammate have different access on different buckets?",
      answer:
         "Yes. A member has a role on the server, and a bucket can override it. The same person can be a Viewer on one bucket and an Editor on another.",
   },
   {
      question: "Can I give a teammate access to just one folder in a bucket?",
      answer:
         "Yes. When you invite a Viewer or Editor, or edit their access later, switch the bucket from Whole bucket to Specific folders and list the folders they should reach. They can browse, upload, rename and delete inside those folders and can't open, list or copy anything else in the bucket. Admins always get whole buckets.",
   },
   {
      question: "How does this work with IAM Identity Center?",
      answer:
         "IAM Identity Center is the right tool for federating identity into AWS itself, including the AWS console — and it's a great choice for many enterprise scenarios. S3 Viewer is a complementary layer on top of S3 (and other S3-compatible providers) for the specific case of human collaboration on object storage. You can use both: Identity Center for federated AWS access, S3 Viewer for the browsing-and-sharing workflow.",
   },
   {
      question: "Does this work with Cloudflare R2 buckets too?",
      answer:
         "Yes. Add an R2 server the same way and invite teammates to it. They never need a Cloudflare account — S3 Viewer handles authentication.",
   },
];

export default createHowToPage({
   slug: SLUG,
   tldr: TLDR,
   seoTitle: "Invite a Teammate to Your S3 Bucket Without IAM",
   seoDescription:
      "Skip per-person IAM users for human collaboration. Add the server once, then invite teammates by email and give them a role.",
   published: "2026-04-28",
   visual: <InviteIllustration />,
   steps,
   underTheHood: (
      <p>
         AWS IAM is built for service-to-service authorization and fine-grained
         programmatic policy. For a small team that just needs to browse and
         share files in a bucket, per-person IAM is heavier than it needs to be:
         a JSON policy per role, a key per person, rotation cycles, and
         off-boarding to remember. S3 Viewer takes a different approach for that
         human-collaboration case: the bucket is connected once with a
         server-level credential, and teammates authenticate to S3 Viewer
         instead of AWS. Their access is enforced on our server — every request
         is checked against their role before it is signed, and roles are
         ordered Viewer &lt; Editor &lt; Admin &lt; Owner, each one adding to
         the last. When you remove them, no keys need rotating because they
         never held any. The same model works for Cloudflare R2 and any other
         S3-compatible provider.
      </p>
   ),
   faqs,
   useCases: ["teams"],
   related: [
      "share-one-folder-in-s3-bucket",
      "set-granular-s3-permissions",
      "iam-user-read-only-one-s3-bucket",
      "share-s3-file-with-non-technical-user",
   ],
});
