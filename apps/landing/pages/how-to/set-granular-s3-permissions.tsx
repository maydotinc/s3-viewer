import { getRelatedHowTos } from "@/components/HowTo/data";
import HowToPage, {
   type HowToFAQ,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import { buildHowToJsonLd } from "@/components/HowTo/jsonld";
import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { getUseCaseRefs } from "@/components/UseCases/data";
import { PermissionsIllustration } from "@/components/UseCases/illustrations";
import { SITE_URL } from "@/lib/site-config";

const SLUG = "set-granular-s3-permissions";
const TITLE = "How to set granular S3 permissions per prefix";
const KEYWORD = "S3 permissions per prefix";
const TLDR =
   "Use an IAM policy with a Resource that includes the prefix and a Condition on s3:prefix for the listing call. Or, in S3 Viewer, set a prefix scope on the user — no IAM required.";

const policyExample = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadPrefix",
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::my-bucket/reports/finance/*"
    },
    {
      "Sid": "ListPrefix",
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
      body: <>Bucket, prefix, or single key. The smaller the scope, the safer.</>,
   },
   {
      title: "IAM: write the read policy",
      body: (
         <>
            Allow <code>s3:GetObject</code> on the keys inside the prefix.
            <code>Resource</code> uses a wildcard.
         </>
      ),
      code: '"Resource": "arn:aws:s3:::my-bucket/reports/finance/*"',
   },
   {
      title: "IAM: add the listing condition",
      body: (
         <>
            Listing requires <code>s3:ListBucket</code> on the bucket itself,
            with a <code>Condition</code> on <code>s3:prefix</code>. This
            trips up most people writing their first IAM policy.
         </>
      ),
      code: policyExample,
   },
   {
      title: "IAM: attach to user or role",
      body: (
         <>
            Attach the policy to the IAM user or role and test with the IAM
            policy simulator before handing it over.
         </>
      ),
   },
   {
      title: "S3 Viewer: skip IAM entirely",
      body: (
         <>
            Invite the user to a workspace, set a prefix scope on their role.
            S3 Viewer enforces the scope server-side using its own
            workspace-level credentials.
         </>
      ),
   },
   {
      title: "Verify",
      body: (
         <>
            Try to list and read outside the prefix. Both methods should
            deny. If they don&apos;t, the policy is too broad.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "How do I give someone access to one folder in an S3 bucket?",
      answer:
         "Either an IAM policy with Resource set to arn:aws:s3:::bucket/prefix/* and an s3:prefix condition for ListBucket, or invite them to S3 Viewer with a prefix scope on their role.",
   },
   {
      question:
         "Why does my IAM policy let users read files but not list the folder?",
      answer:
         "You're missing s3:ListBucket with an s3:prefix condition. Read access alone doesn't grant listing — they're separate permissions in IAM.",
   },
   {
      question: "Can I scope down to a single file?",
      answer:
         "Yes — set Resource to the exact key (no wildcard). In S3 Viewer, set the prefix scope to the full key.",
   },
];

const Page = () => {
   const jsonLd = buildHowToJsonLd({
      slug: SLUG,
      title: TITLE,
      tldr: TLDR,
      siteUrl: SITE_URL,
      steps,
      faqs,
      keyword: KEYWORD,
   });

   return (
      <>
         <Seo
            title="How to Set Granular S3 Permissions Per Prefix"
            description="Two ways to scope S3 access to a single folder: an IAM policy with s3:prefix conditions, or workspace prefix scopes in S3 Viewer."
            canonical={`/how-to/${SLUG}`}
            jsonLd={jsonLd}
         />
         <HowToPage
            eyebrow={TITLE}
            title={TITLE}
            tldr={TLDR}
            visual={<PermissionsIllustration />}
            steps={steps}
            underTheHood={
               <p>
                  S3 has no folders — &ldquo;prefix-scoped&rdquo; access is
                  enforced by IAM policy on the key pattern. The catch is
                  that listing requires a separate <code>s3:ListBucket</code>{" "}
                  permission scoped via{" "}
                  <code>Condition</code>/<code>s3:prefix</code>, which trips
                  up most people writing their first IAM policy. S3 Viewer
                  enforces prefix scopes server-side: the workspace holds
                  bucket-wide credentials but rejects any request from the
                  user whose key isn&apos;t inside their scope.
               </p>
            }
            faqs={faqs}
            useCases={getUseCaseRefs(["security-and-audit", "teams"])}
            related={getRelatedHowTos([
               "invite-teammate-to-s3-bucket",
               "share-s3-file-with-non-technical-user",
               "delete-file-from-s3",
            ])}
         />
      </>
   );
};

Page.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default Page;
