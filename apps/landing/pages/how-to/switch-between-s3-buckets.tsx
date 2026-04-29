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
   "In S3 Viewer, hit Cmd-K and type the bucket name — it jumps instantly. In the CLI, set AWS_PROFILE per shell or per command.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: press Cmd-K",
      body: <>A bucket switcher opens with fuzzy matching across every provider.</>,
   },
   {
      title: "Type any part of the name",
      body: <>Match by bucket name, provider, or workspace. Hit Enter.</>,
   },
   {
      title: "Pin frequent buckets",
      body: <>Star a bucket and it stays at the top of the sidebar.</>,
   },
   {
      title: "CLI alternative: named profiles",
      body: (
         <>
            Configure profiles in <code>~/.aws/credentials</code> and switch
            with <code>AWS_PROFILE</code>.
         </>
      ),
      code: "AWS_PROFILE=acme aws s3 ls s3://bucket-name",
   },
   {
      title: "CLI alternative: --endpoint-url for R2/B2",
      body: <>For R2, B2, and MinIO, pass the endpoint explicitly.</>,
      code:
         "aws s3 ls --profile r2 \\\n  --endpoint-url https://<account>.r2.cloudflarestorage.com",
   },
   {
      title: "Across multiple AWS accounts",
      body: (
         <>
            Add each account&apos;s credentials separately. In S3 Viewer
            they show up grouped by account in the sidebar.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "What's the fastest way to switch between AWS S3 buckets?",
      answer:
         "In S3 Viewer, Cmd-K opens a fuzzy bucket switcher across every connected provider. In the CLI, set AWS_PROFILE per command or shell session.",
   },
   {
      question: "Can I have buckets from multiple AWS accounts open at once?",
      answer:
         "Yes. Add each account's credentials separately; their buckets show up in the sidebar grouped by account.",
   },
   {
      question: "Can I pin frequent buckets?",
      answer:
         "Yes — star a bucket and it stays at the top of the sidebar.",
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
            title="How to Switch Between S3 Buckets Quickly"
            description="Cmd-K bucket switcher, named CLI profiles, and pinned favorites. Three ways to jump between AWS S3 buckets without losing context."
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
                  <code>AWS_PROFILE</code>. That works but adds friction when
                  you bounce between many buckets. S3 Viewer keeps every
                  connected bucket loaded and routes each click to the right
                  signer behind the scenes — no profile switching, no
                  re-auth.
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
