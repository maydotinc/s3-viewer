import { getRelatedHowTos } from "@/components/HowTo/data";
import {
   createHowToPage,
   type HowToFAQ,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import { getUseCaseRefs } from "@/components/UseCases/data";
import { PermissionsIllustration } from "@/components/UseCases/illustrations";

const SLUG = "set-granular-s3-permissions";
const TITLE = "How to set granular S3 permissions per prefix";
const KEYWORD = "S3 permissions per prefix";
const TLDR =
   "AWS IAM is the right tool for fine-grained per-prefix access — write a policy with two statements: s3:GetObject on the prefix wildcard, and s3:ListBucket on the bucket itself with a Condition on s3:prefix. The s3:prefix condition on listing is the part most people miss, which is why first-attempt policies let users read but not list. For human collaboration, S3 Viewer offers a simpler alternative: per-bucket roles assigned by email invite — Owner, Admin, Editor, or Viewer — without writing IAM at all.";

const policyExample = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadInsidePrefix",
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::my-bucket/reports/finance/*"
    },
    {
      "Sid": "ListInsidePrefix",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::my-bucket",
      "Condition": {
        "StringLike": { "s3:prefix": ["reports/finance/*"] }
      }
    }
  ]
}`;

const steps: HowToStep[] = [
   {
      title: "Decide the scope",
      body: (
         <>Bucket, prefix, or single key. The smaller the scope, the safer.</>
      ),
   },
   {
      title: "IAM: write the read statement",
      body: (
         <>
            Allow <code>s3:GetObject</code> on every key inside the prefix.{" "}
            <code>Resource</code> uses a wildcard.
         </>
      ),
      code: '"Resource": "arn:aws:s3:::my-bucket/reports/finance/*"',
   },
   {
      title: "IAM: add the listing condition (the part most people miss)",
      body: (
         <>
            Listing requires <code>s3:ListBucket</code> on the bucket itself
            (not the prefix), with a <code>Condition</code> on{" "}
            <code>s3:prefix</code>. This is why most first-attempt IAM policies
            let users read but not list.
         </>
      ),
      code: policyExample,
   },
   {
      title: "IAM: attach to a user or role and test",
      body: (
         <>
            Attach the policy to the IAM user or role and verify with the IAM
            policy simulator before handing it over. Confirm both list and get
            work inside the prefix and deny outside.
         </>
      ),
   },
   {
      title: "Team workflows: S3 Viewer per-bucket roles",
      body: (
         <>
            Authoring an IAM policy per teammate is heavy for human
            collaboration. For team access, add the server once with a
            least-privilege credential and give each member a role:{" "}
            <strong>Viewer</strong> (browse and download),{" "}
            <strong>Editor</strong> (also upload, rename, delete and create
            buckets) or <strong>Admin</strong> (also manage members, rename the
            server and remove buckets from it). <strong>Owner</strong> is not
            assignable — it stays with whoever created the server, and only an
            Owner can delete it. A bucket can override a member&apos;s server
            role. S3 Viewer enforces those roles on the server; for finer
            per-prefix scoping within a bucket, layer in IAM as above.
         </>
      ),
   },
   {
      title: "Verify",
      body: (
         <>
            Try to list and read outside the prefix. Both should deny. If they
            don&apos;t, the policy is too broad — most likely the{" "}
            <code>Resource</code> wildcard is wrong or the listing{" "}
            <code>Condition</code> is missing.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "How do I give someone access to one folder in an S3 bucket?",
      answer:
         "Write an IAM policy with two statements: `s3:GetObject` on `arn:aws:s3:::bucket/prefix/*` (the read), and `s3:ListBucket` on `arn:aws:s3:::bucket` with a Condition `StringLike: { s3:prefix: ['prefix/*'] }` (the listing). The listing condition is the part most people miss. For team workflows, S3 Viewer offers a simpler primitive — connect the bucket once and grant per-bucket roles to invited members instead of authoring custom IAM per teammate.",
   },
   {
      question:
         "Why does my IAM policy let users read S3 files but not list the folder?",
      answer:
         "You're missing s3:ListBucket with an s3:prefix Condition. In S3, GetObject and ListBucket are separate permissions on different resources — GetObject is on the key (`bucket/prefix/*`), ListBucket is on the bucket (`bucket`). Granting one doesn't grant the other.",
   },
   {
      question: "What's the difference between s3:ListBucket and s3:GetObject?",
      answer:
         "s3:ListBucket is permission to list keys in a bucket — it acts on the bucket ARN. s3:GetObject is permission to read the bytes of a specific key — it acts on the key ARN. To browse a folder, a user needs both: ListBucket to see the keys, GetObject to read them.",
   },
   {
      question: "Can I scope down to a single S3 key?",
      answer:
         "Yes — set Resource to the exact key ARN with no wildcard, e.g., `arn:aws:s3:::my-bucket/reports/q4-finance.pdf`. Pair it with a ListBucket condition on the parent prefix if the user also needs to see it in a listing.",
   },
   {
      question: "Do I need a custom IAM policy for every teammate?",
      answer:
         "Not necessarily. In S3 Viewer, one least-privilege key connects the server and four roles (Owner, Admin, Editor, Viewer) handle who can do what, with a per-bucket override where you need it. Use IAM when you want fine-grained per-prefix scoping; use roles when you want simple per-bucket access for humans.",
   },
   {
      question: "Does this work with Cloudflare R2?",
      answer:
         "R2 has its own token system rather than IAM-style policies. You scope R2 API tokens to specific buckets when you create them in the Cloudflare dashboard. For access control on top of that, S3 Viewer's roles are usually simpler.",
   },
];

export default createHowToPage({
   slug: SLUG,
   title: TITLE,
   tldr: TLDR,
   keyword: KEYWORD,
   seoTitle: "How to Set Granular S3 Permissions Per Prefix (IAM + Roles)",
   seoDescription:
      "Two patterns for scoping S3 access to one folder: an IAM policy with s3:GetObject + s3:ListBucket conditions, or per-bucket roles in S3 Viewer.",
   visual: <PermissionsIllustration />,
   steps,
   underTheHood: (
      <p>
         S3 has no folders — &ldquo;prefix-scoped&rdquo; access is enforced by
         IAM policy on the key pattern. The catch is that listing requires a
         separate <code>s3:ListBucket</code> permission on the <em>bucket</em>{" "}
         ARN scoped via <code>Condition</code>/<code>s3:prefix</code>, which
         trips up most people writing their first IAM policy. For team
         collaboration, S3 Viewer offers an alternative: add the server once
         with one least-privilege key and give invited members a role. Those
         roles are enforced on our server before any S3 call is signed, so you
         don&apos;t have to write a new IAM policy every time you onboard
         someone.
      </p>
   ),
   faqs,
   useCases: getUseCaseRefs(["security-and-audit", "teams"]),
   related: getRelatedHowTos([
      "invite-teammate-to-s3-bucket",
      "share-s3-file-with-non-technical-user",
      "delete-file-from-s3",
   ]),
});
