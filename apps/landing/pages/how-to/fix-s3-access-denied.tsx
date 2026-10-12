import {
   createHowToPage,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import type { Faq } from "@/lib/types";
import { AccessDeniedIllustration } from "@/components/UseCases/illustrations/how-to/access-denied";

const SLUG = "fix-s3-access-denied";
const TLDR =
   "A 403 AccessDenied from Amazon S3 means the request was signed with real credentials but no policy allowed it, or something explicitly denied it. Work through the causes in this order: the wrong identity or profile; an IAM policy that puts s3:ListBucket on the object ARN instead of the bucket ARN, or s3:GetObject without the /* ARN; an explicit Deny in the bucket policy; Block Public Access; an SSE-KMS key you cannot decrypt; an object owned by another account; and an SCP, permission boundary or VPC endpoint policy. Two traps: S3 answers 403 instead of 404 for a missing object when you lack s3:ListBucket, and a wrong region or endpoint can surface as 403. S3 Viewer separates the two big cases for you: “The server rejected these credentials” means the key or secret is wrong, while “The server credentials don't allow this” means the key is valid and a policy said no.";

const steps: HowToStep[] = [
   {
      title: "Confirm which identity is making the call",
      body: (
         <>
            A surprising share of 403s are the wrong profile, an expired SSO
            session, or an instance or container role you did not expect. Ask
            STS who you are before touching any policy. In S3 Viewer the
            identity is the access key saved on that server connection, so check
            which key you pasted.
         </>
      ),
      code: `aws sts get-caller-identity
# {
#   "UserId": "AIDA...",
#   "Account": "123456789012",
#   "Arn": "arn:aws:iam::123456789012:user/s3-viewer-readonly"
# }`,
   },
   {
      title: "Reproduce with the smallest possible call",
      body: (
         <>
            Find out <em>which</em> action is denied. Bucket-level and
            object-level permissions are separate, and <code>aws s3 ls</code>{" "}
            with no bucket needs a third one, <code>s3:ListAllMyBuckets</code>,
            which is often the whole problem.
         </>
      ),
      code: `aws s3api head-bucket --bucket my-bucket
aws s3api list-objects-v2 --bucket my-bucket --prefix exports/ --max-keys 1
aws s3api get-object --bucket my-bucket --key exports/q3.pdf /tmp/q3.pdf`,
   },
   {
      title: "Check the IAM policy's actions and ARNs",
      body: (
         <>
            The most common cause. <code>s3:ListBucket</code> applies to the{" "}
            <strong>bucket</strong> ARN (<code>arn:aws:s3:::my-bucket</code>),
            while <code>s3:GetObject</code>, <code>s3:PutObject</code> and{" "}
            <code>s3:DeleteObject</code> apply to the <strong>object</strong>{" "}
            ARN (<code>arn:aws:s3:::my-bucket/*</code>). Put an action on the
            wrong ARN and it silently grants nothing. Versioned buckets also
            need <code>s3:GetObjectVersion</code> to read old versions.
         </>
      ),
      code: `{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::my-bucket" },
    { "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::my-bucket/*" }
  ]
}`,
   },
   {
      title: "Look for an explicit Deny in the bucket policy",
      body: (
         <>
            An explicit <code>Deny</code> anywhere beats every{" "}
            <code>Allow</code>. The usual suspects are conditions on{" "}
            <code>aws:SourceIp</code> or <code>aws:SourceVpce</code> that block
            your laptop or a server outside the VPC,{" "}
            <code>aws:SecureTransport</code> denies hitting plain-HTTP clients,
            and <code>aws:PrincipalOrgID</code> blocking a principal from
            another organization. For cross-account access, the caller&apos;s
            IAM policy <em>and</em> the bucket policy must both allow the
            action.
         </>
      ),
      code: `aws s3api get-bucket-policy --bucket my-bucket --query Policy --output text | jq .`,
   },
   {
      title: "If the object is encrypted with SSE-KMS, check the key",
      body: (
         <>
            Listing works but every download is 403? That is almost always KMS.
            Reading an object encrypted with a customer managed key needs{" "}
            <code>kms:Decrypt</code> on that key (uploads also need{" "}
            <code>kms:GenerateDataKey</code>), and the key policy itself must
            allow your principal. Cross-account KMS needs both sides, like a
            bucket policy.
         </>
      ),
      code: `aws s3api head-object --bucket my-bucket --key exports/q3.pdf
# "ServerSideEncryption": "aws:kms",
# "SSEKMSKeyId": "arn:aws:kms:us-east-1:123456789012:key/..."`,
   },
   {
      title: "Check who owns the object and whether public access is blocked",
      body: (
         <>
            Objects uploaded by another account under the legacy ACL model can
            be unreadable even by the bucket owner. Fix it once by setting{" "}
            <strong>Object Ownership</strong> to <em>Bucket owner enforced</em>,
            which disables ACLs and makes the bucket owner own everything.
            Separately, <strong>Block Public Access</strong> (on by default
            since 2023) turns public-read policies and ACLs into 403s for
            anonymous requests; that is the feature working as intended.
         </>
      ),
   },
   {
      title: "Check the guardrails outside S3",
      body: (
         <>
            Service control policies, permission boundaries, session policies on
            an assumed role, and VPC endpoint policies can all deny a call that
            every S3-level policy allows. Requester Pays buckets return 403
            unless you send <code>--request-payer requester</code>. Since 2021
            the AccessDenied message usually names the policy type that denied
            you (&ldquo;with an explicit deny in a service control
            policy&rdquo;, &ldquo;because no identity-based policy allows the
            s3:GetObject action&rdquo;), so read the full message. CloudTrail
            records the same detail under <code>errorMessage</code>.
         </>
      ),
   },
   {
      title: "Rule out a 403 that is really a 404, or a wrong region",
      body: (
         <>
            S3 deliberately answers <code>GetObject</code> on a key that does
            not exist with 403 unless the caller has <code>s3:ListBucket</code>,
            so that unauthorized callers cannot probe for key names. If listing
            is not something you are meant to have, check the key spelling
            before the policies. A bucket in another region usually fails with
            301 or 400, but some clients surface it as 403, so confirm the
            endpoint matches the bucket&apos;s location.
         </>
      ),
      code: `aws s3api get-bucket-location --bucket my-bucket
# { "LocationConstraint": "eu-west-1" }   # null means us-east-1`,
   },
   {
      title: "In S3 Viewer, read which of the two messages you got",
      body: (
         <>
            <strong>&ldquo;The server rejected these credentials&rdquo;</strong>{" "}
            maps to <code>InvalidAccessKeyId</code> or{" "}
            <code>SignatureDoesNotMatch</code>: the key or secret is wrong,
            rotated, deleted, or pasted with a stray space. Fix the keys, not
            the policy.{" "}
            <strong>
               &ldquo;The server credentials don&apos;t allow this&rdquo;
            </strong>{" "}
            is a genuine <code>AccessDenied</code>: the key is valid and a
            policy said no, so work through steps 3 to 8. When connecting, if
            the key cannot list buckets S3 Viewer asks for bucket names and
            checks each with <code>HeadBucket</code>; a bucket that fails must
            be granted or removed from the list, and &ldquo;Bucket <em>name</em>{" "}
            was not found&rdquo; is a 404, so check the spelling and endpoint.
         </>
      ),
   },
];

const faqs: Faq[] = [
   {
      question: "What does “Access Denied” mean in Amazon S3?",
      answer:
         "The request was authenticated (S3 recognised the access key and the signature was valid) but not authorized: no identity policy, bucket policy or ACL allowed the action, or a policy explicitly denied it. It is HTTP 403 with the error code AccessDenied. Bad credentials produce different codes, InvalidAccessKeyId or SignatureDoesNotMatch.",
   },
   {
      question:
         "Why do I get Access Denied when my IAM policy grants full S3 access?",
      answer:
         "Because an Allow is not the last word. An explicit Deny in a bucket policy, service control policy, permission boundary, session policy or VPC endpoint policy overrides it; an SSE-KMS key you cannot decrypt fails as 403; and cross-account access needs the bucket policy to allow you too. Also confirm with aws sts get-caller-identity that the policy is attached to the identity actually making the call.",
   },
   {
      question:
         "Why does S3 return 403 instead of 404 for a file that doesn't exist?",
      answer:
         "By design. If the caller lacks s3:ListBucket on the bucket, S3 returns 403 for a missing key rather than 404, so that an unauthorized caller cannot discover which keys exist. Grant s3:ListBucket on the bucket ARN and the same request returns 404 NoSuchKey.",
   },
   {
      question: "Why can I list the bucket but not download objects?",
      answer:
         "Three usual causes: the policy grants s3:GetObject on the bucket ARN instead of arn:aws:s3:::my-bucket/*; the objects are encrypted with an SSE-KMS key you lack kms:Decrypt on; or the objects were uploaded by another account under the legacy ACL model and you are not their owner. Switch Object Ownership to Bucket owner enforced to fix the third.",
   },
   {
      question: "Why do I get Access Denied on aws s3 ls?",
      answer:
         'aws s3 ls with no bucket calls ListBuckets, which needs s3:ListAllMyBuckets on Resource "*". That is a different permission from s3:ListBucket on one bucket. A least-privilege user usually does not have it, so run aws s3 ls s3://my-bucket/ instead. S3 Viewer handles this case by asking you to name the buckets the key can reach.',
   },
   {
      question: "Why does my public S3 bucket still return Access Denied?",
      answer:
         "Most often Block Public Access is on, which is the default for new buckets and overrides any public bucket policy or ACL. Otherwise the bucket policy grants s3:GetObject on the bucket ARN rather than on my-bucket/*, or you are relying on ACLs while Object Ownership is set to Bucket owner enforced, which disables them. Prefer presigned URLs over public buckets when only some people need access.",
   },
   {
      question: "How do I find out which policy is denying my S3 request?",
      answer:
         "Read the full error message: since 2021 AWS names the policy type that denied the request, such as a service control policy or a resource-based policy. Then use the IAM Policy Simulator to test the exact action and resource, check CloudTrail for the event's errorMessage, and use IAM Access Analyzer to validate the policy text.",
   },
   {
      question:
         "What is the difference between AccessDenied, InvalidAccessKeyId and SignatureDoesNotMatch?",
      answer:
         "InvalidAccessKeyId means the access key ID does not exist (deleted, mistyped or from another account). SignatureDoesNotMatch means the key exists but the secret is wrong, or the request was signed for a different region or with a skewed clock. AccessDenied means both were right and a policy refused the action. S3 Viewer shows the first two as “The server rejected these credentials” and the last as “The server credentials don't allow this”.",
   },
   {
      question: "Why do I get Access Denied on Cloudflare R2?",
      answer:
         "R2 API tokens carry their own permissions: an Object Read only token cannot write, and a token scoped to specific buckets cannot call ListBuckets at all. Check the token's permission level and bucket scope in the R2 dashboard. When a bucket-scoped token connects to S3 Viewer, it asks you to type the bucket names instead of failing.",
   },
];

export default createHowToPage({
   slug: SLUG,
   tldr: TLDR,
   seoTitle: "Fix S3 “Access Denied” (403): a 9-Step Checklist",
   seoDescription:
      "S3 returned 403 AccessDenied? Check the identity, IAM ARNs, bucket-policy denies, Block Public Access, KMS keys, object ownership and the 403 that hides a 404.",
   published: "2026-09-05",
   visual: <AccessDeniedIllustration />,
   steps,
   underTheHood: (
      <>
         <p>
            Every S3 request is authorized by evaluating <strong>all</strong>{" "}
            applicable policies together: the caller&apos;s identity-based
            policies, the bucket policy, object and bucket ACLs where they are
            still enabled, any session policy, plus the organization&apos;s
            service control policies, permission boundaries and the VPC endpoint
            policy if the call came through one. The rule is simple:{" "}
            <strong>an explicit Deny anywhere wins</strong>; otherwise at least
            one Allow must match the action <em>and</em> the resource ARN; and
            for a caller in another account, both that caller&apos;s policies
            and the bucket policy must allow it.
         </p>
         <p>
            Resources are where most people slip. Bucket operations (
            <code>ListBucket</code>, <code>GetBucketLocation</code>) match{" "}
            <code>arn:aws:s3:::my-bucket</code>; object operations match{" "}
            <code>arn:aws:s3:::my-bucket/*</code>; and{" "}
            <code>ListAllMyBuckets</code> only matches <code>*</code>.
            Encryption adds a second authorization: reading an SSE-KMS object
            needs a KMS decrypt that succeeds under the key policy, and a KMS
            failure is reported by S3 as a plain 403.
         </p>
         <p>
            S3 Viewer classifies the error codes it gets back from the bucket.
            Credential failures (<code>InvalidAccessKeyId</code>,{" "}
            <code>SignatureDoesNotMatch</code>, <code>ExpiredToken</code>)
            become &ldquo;The server rejected these credentials&rdquo;;{" "}
            <code>AccessDenied</code> becomes &ldquo;The server credentials
            don&apos;t allow this&rdquo;; a 404 on a bucket becomes
            &ldquo;Bucket not found&rdquo;. When a key cannot call{" "}
            <code>ListBuckets</code>, connecting falls back to{" "}
            <code>HeadBucket</code> on each bucket you name, so prefix- or
            bucket-scoped credentials work without any wildcard permissions.
         </p>
      </>
   ),
   faqs,
   useCases: ["security-and-audit", "s3-browser"],
   related: [
      "iam-user-read-only-one-s3-bucket",
      "set-granular-s3-permissions",
      "download-file-from-s3",
   ],
});
