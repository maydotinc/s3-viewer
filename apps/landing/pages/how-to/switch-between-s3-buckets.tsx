import { getRelatedHowTos } from "@/components/HowTo/data";
import HowToPage, {
   type HowToFAQ,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import { buildHowToJsonLd } from "@/components/HowTo/jsonld";
import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { getUseCaseRefs } from "@/components/UseCases/data";
import { SwitchBucketsIllustration } from "@/components/UseCases/illustrations";
import { SITE_URL } from "@/lib/site-config";

const SLUG = "switch-between-s3-buckets";
const TITLE = "How to switch between S3 buckets quickly";
const KEYWORD = "switch between S3 buckets";
const TLDR =
   "In S3 Viewer, hit Cmd-K and fuzzy-match any bucket on any connected provider. In the AWS CLI, configure named profiles in ~/.aws/credentials and switch with AWS_PROFILE. The CLI route works fine for single-bucket scripts; Cmd-K wins when you bounce between many.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: press Cmd-K",
      body: (
         <>
            A bucket switcher opens with fuzzy matching across every bucket
            on every connected provider — AWS, R2, MinIO, anything you&apos;ve
            wired up.
         </>
      ),
   },
   {
      title: "Type any part of the name",
      body: (
         <>
            Match by bucket name or provider. Hit <code>Enter</code> to jump.
            No re-authenticating, no profile switching.
         </>
      ),
   },
   {
      title: "AWS CLI: named profiles",
      body: (
         <>
            Configure profiles in <code>~/.aws/credentials</code> and switch
            with <code>AWS_PROFILE</code>. Works for single-shell workflows
            but adds friction when you bounce.
         </>
      ),
      code: "AWS_PROFILE=acme aws s3 ls s3://bucket-name",
   },
   {
      title: "AWS CLI for R2/B2/MinIO: --endpoint-url",
      body: (
         <>
            For Cloudflare R2, Backblaze B2, or MinIO, pass the endpoint
            explicitly. The credentials format is the same; only the URL
            changes.
         </>
      ),
      code: "aws s3 ls --profile r2 \\\n  --endpoint-url https://<account>.r2.cloudflarestorage.com",
   },
   {
      title: "Across multiple AWS accounts",
      body: (
         <>
            Add each account&apos;s credentials separately. In S3 Viewer they
            show up grouped by account in the sidebar; in the CLI they&apos;re
            separate profiles.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "What's the fastest way to switch between AWS S3 buckets?",
      answer:
         "In S3 Viewer, hit Cmd-K to open a fuzzy bucket switcher across every connected provider — type any part of a bucket name and press Enter. In the AWS CLI, set AWS_PROFILE per command or per shell session.",
   },
   {
      question: "Can I have buckets from multiple AWS accounts open at once?",
      answer:
         "Yes. Connect each AWS account separately — S3 Viewer keeps a separate signer per credential. Buckets show up in the sidebar grouped by account so you can tell them apart.",
   },
   {
      question: "How do I switch between AWS profiles in the CLI?",
      answer:
         "Set the AWS_PROFILE environment variable per command (`AWS_PROFILE=acme aws s3 ls`) or per shell (`export AWS_PROFILE=acme`). Profiles are configured in ~/.aws/credentials.",
   },
   {
      question: "Can I jump between an AWS bucket and a Cloudflare R2 bucket?",
      answer:
         "Yes — Cmd-K in S3 Viewer covers every connected provider in one switcher. The same hotkey jumps from AWS to R2 to MinIO without re-authenticating.",
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
            title="How to Switch Between S3 Buckets Quickly (Cmd-K and CLI)"
            description="Two ways to jump between AWS S3 buckets without losing context: a Cmd-K fuzzy switcher in S3 Viewer, or named profiles in the AWS CLI."
            canonical={`/how-to/${SLUG}`}
            jsonLd={jsonLd}
         />
         <HowToPage
            eyebrow={TITLE}
            title={TITLE}
            tldr={TLDR}
            visual={<SwitchBucketsIllustration />}
            steps={steps}
            underTheHood={
               <p>
                  The AWS CLI scopes credentials per profile (
                  <code>~/.aws/credentials</code>) and you switch by setting{" "}
                  <code>AWS_PROFILE</code>. That works for single-shell
                  workflows but adds friction when you bounce between many
                  buckets in a session. S3 Viewer keeps every connected
                  bucket loaded and routes each click to the right signer
                  behind the scenes — no profile switching, no re-auth.
                  Cmd-K is just fuzzy search over every bucket on every
                  provider you have wired up.
               </p>
            }
            faqs={faqs}
            useCases={getUseCaseRefs(["multi-cloud", "s3-browser"])}
            related={getRelatedHowTos([
               "view-s3-and-r2-side-by-side",
               "search-across-s3-buckets",
               "invite-teammate-to-s3-bucket",
            ])}
         />
      </>
   );
};

Page.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default Page;
