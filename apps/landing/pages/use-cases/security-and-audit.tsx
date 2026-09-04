import { getRelatedHowTos } from "@/components/HowTo/data";
import { getRelated } from "@/components/UseCases/data";
import { SecurityIllustration } from "@/components/UseCases/illustrations";
import {
   createUseCasePage,
   type UseCaseFAQ,
   type UseCaseStep,
} from "@/components/UseCases/use-case-page";
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
const META_DESCRIPTION =
   "Credentials encrypted in your browser, object bytes that are streamed and never stored, no per-person IAM users, and an MIT-licensed build you can self-host.";
const DESCRIPTION =
   "S3 Viewer is designed to be the kind of tool that doesn't add new attack surface. Credentials are encrypted in your browser before they reach us and decrypted only to run the operation you asked for. Uploads stream through our server into your bucket without being stored; downloads go straight from your bucket to the browser. No per-person IAM users to rotate at off-boarding. MIT-licensed and self-hostable inside your own VPC.";

const steps: UseCaseStep[] = [
   {
      title: "Connect with least-privilege keys",
      body: "Use an IAM policy scoped to the buckets and operations you actually need — typically s3:ListBucket, s3:GetObject, s3:PutObject, and s3:DeleteObject on specific bucket ARNs. If your token can't call ListBuckets, name the buckets it may reach when you add the server.",
   },
   {
      title: "Invite the team — no IAM users to mint",
      body: "Each member gets their own login and a role — Owner, Admin, Editor or Viewer — with a per-bucket override where you need one. Off-boarding is removing them from the members dialog; you don't rotate any AWS keys because they never had any.",
   },
   {
      title: "Self-host if compliance demands it",
      body: "Drop the open-source build inside your VPC. Credentials, sessions, and request signing all stay on your infrastructure — self-hosted, there is no third party in the request path at all.",
   },
];

const faqs: UseCaseFAQ[] = [
   {
      question: "Where are my AWS credentials stored?",
      answer:
         "Encrypted in your browser with a public key before they are sent to us, so we only ever store the ciphertext: AES-256-GCM with the data key wrapped using RSA-OAEP (SHA-256). They are decrypted in memory only to run the operation you asked for, then discarded. They never come back to the browser, never appear in an API response, and never enter a log. Self-hosted, you hold the private key.",
   },
   {
      question: "Do you store the contents of my S3 objects?",
      answer:
         "No. Uploads pass through our API as a stream — the bytes go from your browser into your bucket in 25 MB parts, in memory, and are never written to disk or kept once the upload finishes; streaming them this way is what lets uploads work without any CORS or bucket configuration. Downloads and previews go straight from your bucket to your browser over 15-minute presigned URLs and never touch us. Everything else the API does moves no object data: listing, metadata, signing download links, rename (a server-side copy plus a delete), delete and bucket creation. There is no object cache, no object database, and no object storage on our side.",
   },
   {
      question: "How is this safer than minting IAM users for every teammate?",
      answer:
         "Per-person IAM users are permanent artifacts: keys to rotate, console access to manage, off-boarding to remember. S3 Viewer members aren't IAM users — they sign in to S3 Viewer, and their role is checked on our server before any request is signed with the server's single credential. Removing them cuts access immediately; no AWS keys to cycle, no policies to update, nothing for an attacker to lift from a stale config.",
   },
   {
      question: "Can I run S3 Viewer entirely inside my own infrastructure?",
      answer:
         "Yes. The repo is open source under the MIT license. Self-host it behind your VPN or inside your VPC and credentials, sessions, and traffic never leave your network. The RSA key pair used to encrypt credentials is yours to generate and manage.",
   },
   {
      question: "How do I off-board someone who's leaving?",
      answer:
         "Remove them in the members dialog. They lose access to that server on their next request. You don't have to rotate any AWS or R2 keys — they never held any. Other teammates and applications keep working.",
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

export default createUseCasePage({
   slug: SLUG,
   title: TITLE,
   keyword: KEYWORD,
   description: DESCRIPTION,
   seoTitle: "Secure S3 Access — Client-Encrypted Keys, MIT Open Source",
   seoDescription: META_DESCRIPTION,
   eyebrow: "Security",
   tagline: "A tool you can hand to your security review.",
   bullets: [
      "Credentials encrypted in your browser — decrypted only in memory, to sign",
      "Object bytes are never stored — uploads stream through, downloads go bucket to browser",
      "MIT-licensed and self-hostable inside your VPC",
   ],
   visual: <SecurityIllustration />,
   features: [
      {
         icon: KeyRound,
         title: "Client-encrypted credentials",
         body: "Access keys are encrypted in your browser before they are sent — AES-256-GCM with the key wrapped using RSA-OAEP (SHA-256). Decrypted in memory only to run the operation you asked for, then discarded. They never come back to the browser, never appear in logs, never return in API responses.",
      },
      {
         icon: Database,
         title: "Object bytes are never stored",
         body: "Uploads stream through our API into your bucket in memory and are discarded as they go — no disk, no cache, no object database — which is why your bucket needs no CORS rule or other setting. Downloads and previews run bucket-to-browser over 15-minute presigned URLs and never touch us at all.",
      },
      {
         icon: Lock,
         title: "No IAM users to rotate",
         body: "Members aren't IAM users — they sign in to S3 Viewer and their role is checked before any request is signed with the server's single credential. Off-boarding is removing them. Nothing permanent for attackers to lift, nothing for you to forget about.",
      },
      {
         icon: UserMinus,
         title: "Remove without key rotation",
         body: "Removing a member cuts their access on the next request. No AWS keys to cycle, no policies to edit, no other teammates affected, no applications broken.",
      },
      {
         icon: Server,
         title: "Self-host on your VPC",
         body: "MIT-licensed. Self-host with PostgreSQL, your own RSA key pair, and HTTPS — credentials never have to leave your network.",
      },
      {
         icon: Github,
         title: "Open and auditable",
         body: "The full source is on GitHub. Read the encryption code, the request signing path, and the role checks for yourself before you trust it.",
      },
   ],
   steps,
   faqs,
   relatedHowTos: getRelatedHowTos([
      "set-granular-s3-permissions",
      "invite-teammate-to-s3-bucket",
      "delete-file-from-s3",
   ]),
   related: getRelated(SLUG),
});
