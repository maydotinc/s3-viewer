import {
   createHowToPage,
   type HowToFAQ,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import { getRelatedHowTos } from "@/components/HowTo/data";
import { getUseCaseRefs } from "@/components/UseCases/data";
import { IamReadOnlyIllustration } from "@/components/UseCases/illustrations";

const SLUG = "iam-user-read-only-one-s3-bucket";
const TITLE =
   "How to create an IAM user with read-only access to one S3 bucket";
const KEYWORD = "S3 read-only IAM policy";
const TLDR =
   "Create an IAM user with no console access, attach an inline policy that allows s3:ListBucket and s3:GetBucketLocation on arn:aws:s3:::my-bucket and s3:GetObject on arn:aws:s3:::my-bucket/*, then create an access key. That is the entire least-privilege policy: no s3:ListAllMyBuckets, no wildcard resources, nothing that can write or delete. Skip the AmazonS3ReadOnlyAccess managed policy; it reads every bucket in the account. When you paste the keys into S3 Viewer it notices the user cannot list buckets, asks you to name the one it can read, checks it with HeadBucket, and connects.";

const POLICY = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListTheBucket",
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::my-bucket"
    },
    {
      "Sid": "ReadObjects",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:GetObjectVersion"],
      "Resource": "arn:aws:s3:::my-bucket/*"
    }
  ]
}`;

const steps: HowToStep[] = [
   {
      title: "Decide what read-only has to cover",
      body: (
         <>
            Listing and downloading is the baseline: <code>s3:ListBucket</code>,{" "}
            <code>s3:GetBucketLocation</code> and <code>s3:GetObject</code>. Add{" "}
            <code>s3:GetObjectVersion</code> and{" "}
            <code>s3:ListBucketVersions</code> if the bucket is versioned and
            old versions matter, and <code>kms:Decrypt</code> on the key if
            objects use SSE-KMS. Leave out <code>s3:ListAllMyBuckets</code>: it
            can only be granted on <code>*</code> and reveals every bucket name
            in the account.
         </>
      ),
   },
   {
      title: "Write the policy",
      body: (
         <>
            Two statements, two ARNs. Bucket-level actions go on{" "}
            <code>arn:aws:s3:::my-bucket</code>; object-level actions go on{" "}
            <code>arn:aws:s3:::my-bucket/*</code>. Swapping them is the classic
            way to end up with Access Denied. Replace <code>my-bucket</code> in
            both places.
         </>
      ),
      code: POLICY,
   },
   {
      title: "Create the user and attach the policy (console)",
      body: (
         <>
            IAM → <strong>Users</strong> → <strong>Create user</strong>. Name it
            for its job, for example <code>s3-viewer-readonly</code>, and leave
            &ldquo;Provide user access to the AWS Management Console&rdquo;
            unchecked. On the permissions step choose{" "}
            <strong>Attach policies directly</strong> →{" "}
            <strong>Create policy</strong>, switch to the <strong>JSON</strong>{" "}
            tab, paste the policy above, name it{" "}
            <code>S3ReadOnly-my-bucket</code>, then return to the user wizard,
            refresh the list, tick the new policy and finish.
         </>
      ),
   },
   {
      title: "Or do the same from the CLI",
      body: (
         <>
            Save the JSON as <code>s3-readonly.json</code>. An inline policy (
            <code>put-user-policy</code>) is deleted with the user, which is
            what you want for a single-purpose identity.
         </>
      ),
      code: `aws iam create-user --user-name s3-viewer-readonly
aws iam put-user-policy \\
  --user-name s3-viewer-readonly \\
  --policy-name S3ReadOnly-my-bucket \\
  --policy-document file://s3-readonly.json`,
   },
   {
      title: "Create an access key",
      body: (
         <>
            Open the user → <strong>Security credentials</strong> →{" "}
            <strong>Create access key</strong>. Pick &ldquo;Application running
            outside AWS&rdquo; or &ldquo;Third-party service&rdquo;, then copy
            both values. The secret is shown exactly once. A user can hold two
            keys at a time, which is what makes rotation possible later.
         </>
      ),
      code: `aws iam create-access-key --user-name s3-viewer-readonly
# "AccessKeyId": "AKIA...", "SecretAccessKey": "..."  (shown once)`,
   },
   {
      title: "Test the boundary",
      body: (
         <>
            Prove that it can read the bucket and nothing else. The second and
            third commands <em>should</em> fail with AccessDenied.
         </>
      ),
      code: `aws configure --profile readonly          # paste the new keys

aws s3 ls s3://my-bucket/ --profile readonly              # works
aws s3 ls --profile readonly                              # AccessDenied (expected)
aws s3 cp ./x.txt s3://my-bucket/x.txt --profile readonly # AccessDenied (expected)`,
   },
   {
      title: "Connect it in S3 Viewer",
      body: (
         <>
            <strong>Connect server</strong> → Endpoint{" "}
            <code>https://s3.us-east-1.amazonaws.com</code> (use the
            bucket&apos;s region), pick the region, paste the access key ID and
            secret. Because the user cannot list buckets, S3 Viewer shows a{" "}
            <strong>Bucket names</strong> field: type <code>my-bucket</code>,
            press <strong>Check</strong> and it verifies the name with{" "}
            <code>HeadBucket</code>, then <strong>Connect</strong>. The keys are
            encrypted in your browser with the server&apos;s public key before
            they are sent. Teammates you invite afterwards get a Viewer or
            Editor role on top of this key and never see the AWS credentials.
         </>
      ),
   },
   {
      title: "Harden and maintain it",
      body: (
         <>
            Narrow the grant to a prefix with an <code>s3:prefix</code>{" "}
            condition if the user only needs one folder. Add an{" "}
            <code>aws:SourceIp</code> condition when the caller has a fixed
            address. Rotate keys by creating the second key, swapping it in,
            then deactivating and deleting the first. For humans, prefer roles
            through IAM Identity Center; reserve IAM users with static keys for
            tools like this that need them, one user per tool.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question:
         "What is the minimum IAM policy for read-only access to one S3 bucket?",
      answer:
         "Two Allow statements: s3:ListBucket and s3:GetBucketLocation on arn:aws:s3:::my-bucket, and s3:GetObject (plus s3:GetObjectVersion for versioned buckets) on arn:aws:s3:::my-bucket/*. Nothing else. That lets the user list and download objects in that bucket and do nothing anywhere else in the account.",
   },
   {
      question: "Do I need s3:ListAllMyBuckets for a read-only user?",
      answer:
         'No. s3:ListAllMyBuckets only powers the ListBuckets call (aws s3 ls with no bucket) and can only be granted on Resource "*", so it exposes every bucket name in the account. Tools that need it fail without it; S3 Viewer instead asks you to type the bucket names and verifies each with HeadBucket.',
   },
   {
      question:
         "Should I just attach the AmazonS3ReadOnlyAccess managed policy?",
      answer:
         "Not for one bucket. AmazonS3ReadOnlyAccess grants s3:Get* and s3:List* on every bucket in the account, including buckets created later. Write the two-statement inline policy instead so the key can only reach the bucket you intend.",
   },
   {
      question: "Why does aws s3 ls give Access Denied with my read-only user?",
      answer:
         "Because with no bucket argument it calls ListBuckets, which needs s3:ListAllMyBuckets, a permission this policy deliberately omits. Run aws s3 ls s3://my-bucket/ instead. Access Denied there would mean the ListBucket statement is on the wrong ARN.",
   },
   {
      question: "How do I limit read-only access to one folder in the bucket?",
      answer:
         'Keep s3:ListBucket on the bucket ARN but add a Condition of StringLike s3:prefix: ["reports/*", "reports/"], and change the object statement\'s Resource to arn:aws:s3:::my-bucket/reports/*. The user can then list and read only under reports/. Our guide on granular S3 permissions walks through it.',
   },
   {
      question: "Should this be an IAM user or an IAM role?",
      answer:
         "A role, whenever the caller can assume one: AWS compute, federated humans through IAM Identity Center, or cross-account access. An IAM user with a long-lived access key is the right tool only for external software that needs static credentials, which is exactly the case for connecting a bucket to a self-hosted browser. Keep it single-purpose and rotate the key.",
   },
   {
      question:
         "How do I create read-only credentials for a Cloudflare R2 bucket?",
      answer:
         "In the Cloudflare dashboard open R2 → Manage R2 API Tokens → Create API token, choose the Object Read only permission and scope it to the specific bucket. Cloudflare shows an Access Key ID and Secret Access Key for the S3 API. Connect with endpoint https://<account-id>.r2.cloudflarestorage.com and region auto; because the token is bucket-scoped it cannot list buckets, so S3 Viewer will ask for the bucket name.",
   },
   {
      question:
         "Can I give a teammate read-only access without creating an IAM user for them?",
      answer:
         "Yes. Connect the bucket once with a read-only key, then invite the teammate to that server in S3 Viewer with the Viewer role. They sign in with their email, see only the buckets you grant, and never receive AWS credentials; revoking them is one click and does not touch IAM.",
   },
   {
      question: "Can a read-only user open encrypted objects?",
      answer:
         "Objects encrypted with SSE-S3 (the default) need nothing extra. Objects encrypted with SSE-KMS need kms:Decrypt on the key in the user's policy and a key policy that allows the user; otherwise every download returns Access Denied even though listing works.",
   },
];

export default createHowToPage({
   slug: SLUG,
   title: TITLE,
   tldr: TLDR,
   keyword: KEYWORD,
   seoTitle: "Read-Only IAM User for One S3 Bucket: Policy JSON + Steps",
   seoDescription:
      "The least-privilege IAM policy for read-only access to a single S3 bucket, the console and CLI steps to create the user and keys, and how to test it.",
   published: "2026-09-05",
   visual: <IamReadOnlyIllustration />,
   steps,
   underTheHood: (
      <>
         <p>
            S3 permissions come in two shapes. <strong>Bucket-level</strong>{" "}
            actions (<code>ListBucket</code>, <code>GetBucketLocation</code>,{" "}
            <code>ListBucketVersions</code>) are evaluated against the bucket
            ARN, <code>arn:aws:s3:::my-bucket</code>.{" "}
            <strong>Object-level</strong> actions (<code>GetObject</code>,{" "}
            <code>PutObject</code>, <code>DeleteObject</code>) are evaluated
            against object ARNs, which is why they need the <code>{"/*"}</code>{" "}
            suffix. A single statement cannot cover both, so the smallest
            correct policy always has two. <code>ListAllMyBuckets</code> is a
            third shape, account-wide with no resource to scope, which is why
            least-privilege policies leave it out.
         </p>
         <br />
         <p>
            S3 Viewer is built for keys like this. When you connect, it first
            tries <code>ListBuckets</code>; on <code>AccessDenied</code> it
            switches to asking for bucket names and calls{" "}
            <code>HeadBucket</code> on each one, so a bucket-scoped or
            prefix-scoped key works without any wildcard grants. The key is
            encrypted in the browser with the server&apos;s public key before it
            leaves the page, and every request S3 Viewer signs on your behalf is
            still bounded by this IAM policy: a Viewer in the app cannot do more
            than the key can.
         </p>
         <br />
         <p>
            The practical pattern for teams is one read-only IAM user per
            connected bucket, then S3 Viewer invites for people. IAM stays
            small, the AWS key never leaves the server, and access changes are
            made in the app instead of in the IAM console.
         </p>
      </>
   ),
   faqs,
   useCases: getUseCaseRefs(["security-and-audit", "teams"]),
   related: getRelatedHowTos([
      "set-granular-s3-permissions",
      "fix-s3-access-denied",
      "invite-teammate-to-s3-bucket",
   ]),
});
