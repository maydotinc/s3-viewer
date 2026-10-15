import { SecurityIllustration } from "@/components/UseCases/illustrations/use-cases/security";
import {
   createUseCasePage,
   type UseCaseStep,
} from "@/components/UseCases/use-case-page";
import type { Faq } from "@/lib/types";
import { Database, KeyRound, Lock, ScrollText, Server } from "lucide-react";
import { GitHubMark } from "@/components/social-marks";

const SLUG = "security-and-audit";
const TITLE = "Built so security teams sign off.";
const META_DESCRIPTION =
   "Credentials encrypted in your browser, no persistent object storage, no per-person IAM users, and an MIT-licensed build you can self-host.";
const DESCRIPTION =
   "Credentials are encrypted in your browser before they reach us and decrypted only to run the operation you asked for. Uploads, editing, cross-server transfers, and ZIP downloads process object contents in memory without persisting them. Individual downloads go straight from your bucket to the browser. No per-person IAM users to rotate at off-boarding. MIT-licensed and self-hostable inside your own VPC.";

const steps: UseCaseStep[] = [
   {
      title: "Connect with least-privilege keys",
      body: "Use an IAM policy scoped to the buckets and operations you actually need — typically s3:ListBucket, s3:GetObject, s3:PutObject, and s3:DeleteObject on specific bucket ARNs. If your token can't call ListBuckets, name the buckets it may reach when you add the server.",
   },
   {
      title: "Invite the team — no IAM users to mint",
      body: "Each member gets their own login and a role — Owner, Admin, Editor or Viewer — with a per-bucket override where you need one. Off-boarding is removing them under Settings, Members; you don't rotate any AWS keys because they never had any.",
   },
   {
      title: "Self-host if compliance demands it",
      body: "Drop the open-source build inside your VPC. Credentials, sessions, and request signing all stay on your infrastructure — self-hosted, there is no third party in the request path at all.",
   },
];

const faqs: Faq[] = [
   {
      question: "Where are my AWS credentials stored?",
      answer:
         "Encrypted in your browser with a public key before they are sent to us, so we only ever store the ciphertext: AES-256-GCM with the data key wrapped using RSA-OAEP (SHA-256). They are decrypted in memory only to run the operation you asked for, then discarded. They never come back to the browser, never appear in an API response, and never enter a log. Self-hosted, you hold the private key.",
   },
   {
      question: "Do you store the contents of my S3 objects?",
      answer:
         "We do not persist object contents. Smaller uploads arrive in a single API request; larger uploads use browser-coordinated multipart requests through the API. Both stream bytes into your bucket in memory, without writing object contents to disk or requiring bucket CORS changes. Individual downloads and media previews use 15-minute presigned URLs to load directly from your bucket. The editor, cross-server transfers, and ZIP archive downloads also process object contents through the API in memory. Same-server copies and renames use the storage provider's copy operations. Listing, metadata, signing download links, and deletion do not read object contents. There is no persistent object cache, object database, or object storage on our side.",
   },
   {
      question: "How is this safer than minting IAM users for every teammate?",
      answer:
         "Per-person IAM users are permanent artifacts: keys to rotate, console access to manage, off-boarding to remember. S3 Viewer members aren't IAM users — they sign in to S3 Viewer, and their role is checked on our server before any request is signed with the server's single credential. Removing them cuts access on their next request, though a download link they already opened keeps working for up to 15 minutes; no AWS keys to cycle, no policies to update, nothing for an attacker to lift from a stale config.",
   },
   {
      question: "Can I run S3 Viewer entirely inside my own infrastructure?",
      answer:
         "Yes. The repo is open source under the MIT license. Self-host it behind your VPN or inside your VPC and credentials, sessions, and traffic never leave your network. The RSA key pair used to encrypt credentials is yours to generate and manage.",
   },
   {
      question: "How do I off-board someone who's leaving?",
      answer:
         "Remove them under Settings, Members. They lose access to that server on their next request; a download link they already opened keeps working for up to 15 minutes. You don't have to rotate any AWS or R2 keys — they never held any. Other teammates and applications keep working.",
   },
   {
      question: "Is there an audit log?",
      answer:
         "Owners can switch on a tamper-evident audit log per server; it is off until they do. Every record is hash-chained to the previous one, so Verify integrity detects edited or missing rows. The owner decides who can view it, whether it records everything or only changes and downloads, and how long records are kept — self-hosters set the minimum with AUDIT_RETENTION_MIN_DAYS (90 days by default). It covers actions taken through S3 Viewer; changes made with other keys or the provider's console never appear.",
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
   description: DESCRIPTION,
   seoTitle: "Secure S3 Access — Encrypted Keys, Open Source",
   seoDescription: META_DESCRIPTION,
   eyebrow: "Security",
   headline: "A tool you can hand to your security review.",
   bullets: [
      "Credentials encrypted in your browser — decrypted only in memory, to sign",
      "No persistent object storage — contents are processed for your requested operations",
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
         title: "No persistent object storage",
         body: "Uploads stream through the API into your bucket using a single request or browser-coordinated multipart requests. Editing, cross-server transfers, and ZIP downloads also process contents in memory without persisting them. Individual downloads and media previews load directly from your bucket over 15-minute presigned URLs.",
      },
      {
         icon: Lock,
         title: "No IAM users to rotate",
         body: "Members aren't IAM users — they sign in to S3 Viewer and their role is checked before any request is signed with the server's single credential. Removing one cuts their access on the next request; a download link they already opened keeps working for up to 15 minutes. No AWS keys to cycle, nothing for you to forget about.",
      },
      {
         icon: ScrollText,
         title: "Tamper-evident audit log",
         body: "Owners can switch on an audit log per server. Each record is hash-chained to the one before it, so Verify integrity catches edited or missing rows. Choose who can view it, whether it records everything or only changes and downloads, and how long records are kept; export to CSV any time.",
      },
      {
         icon: Server,
         title: "Self-host on your VPC",
         body: "MIT-licensed. Self-host with PostgreSQL, your own RSA key pair, and HTTPS — credentials never have to leave your network.",
      },
      {
         icon: GitHubMark,
         title: "Open and auditable",
         body: "The full source is on GitHub. Read the encryption code, the request signing path, and the role checks for yourself before you trust it.",
      },
   ],
   steps,
   faqs,
   relatedHowTos: [
      "set-granular-s3-permissions",
      "invite-teammate-to-s3-bucket",
      "delete-file-from-s3",
   ],
});
