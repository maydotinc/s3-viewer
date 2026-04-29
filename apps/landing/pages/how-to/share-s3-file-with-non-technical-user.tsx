import { getRelatedHowTos } from "@/components/HowTo/data";
import HowToPage, {
   type HowToFAQ,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import { buildHowToJsonLd } from "@/components/HowTo/jsonld";
import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { getUseCaseRefs } from "@/components/UseCases/data";
import { ShareLinkIllustration } from "@/components/UseCases/illustrations";
import { SITE_URL } from "@/lib/site-config";

const SLUG = "share-s3-file-with-non-technical-user";
const TITLE = "How to share an S3 file with a non-technical user";
const KEYWORD = "share S3 file with non-technical user";
const TLDR =
   "For one-off sharing, generate a presigned URL. For ongoing access, invite them to an S3 Viewer workspace scoped to that file or prefix — no AWS account needed.";

const steps: HowToStep[] = [
   {
      title: "Decide: one-time or ongoing?",
      body: (
         <>
            Presigned URL for a single download or a few days of access.
            Workspace invite for repeat access, audit, and revocation.
         </>
      ),
   },
   {
      title: "One-time: generate a presigned URL",
      body: (
         <>
            The link works in any browser and expires after the duration you
            set. Treat it as a bearer token — anyone with the link gets the
            file.
         </>
      ),
      code: "aws s3 presign s3://my-bucket/contract.pdf --expires-in 3600",
   },
   {
      title: "Ongoing: open S3 Viewer",
      body: (
         <>
            Right-click the file or prefix and click Share. Scope it to the
            specific path you want them to access.
         </>
      ),
   },
   {
      title: "Type their email and pick a role",
      body: (
         <>
            Viewer for read-only. Editor if they need to upload back. Set an
            optional expiry so the invite auto-cleans itself.
         </>
      ),
   },
   {
      title: "Send the link",
      body: (
         <>
            They click, sign in (Google or email), and see only the file or
            prefix you shared — no AWS account, no IAM, nothing to install.
         </>
      ),
   },
   {
      title: "Revoke when done",
      body: (
         <>
            One click. Their session ends and the workspace stops signing S3
            calls for them — no IAM key rotation needed.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "How do I send an S3 file to a client who doesn't use AWS?",
      answer:
         "Quickest: a presigned URL (aws s3 presign), which works in any browser and expires. For repeat access, invite them to an S3 Viewer workspace scoped to that prefix — they sign in once and see only what you shared.",
   },
   {
      question: "Are presigned URLs safe to share?",
      answer:
         "Safe enough for short-lived sharing — they expire and don't expose your credentials. Not safe for ongoing access because anyone who gets the link can use it, and you can't revoke it short of letting it expire.",
   },
   {
      question: "Can the recipient upload back to me?",
      answer:
         "Presigned URLs can be issued for PUT as well, but it's clunky. In S3 Viewer, give them the editor role on a prefix — they can upload there directly.",
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
            title="How to Share an S3 File With a Non-Technical User"
            description="Two ways to share S3 files with people who don't use AWS: a presigned URL for one-off sharing, or a workspace invite for ongoing access."
            canonical={`/how-to/${SLUG}`}
            jsonLd={jsonLd}
         />
         <HowToPage
            eyebrow={TITLE}
            title={TITLE}
            tldr={TLDR}
            visual={<ShareLinkIllustration />}
            steps={steps}
            underTheHood={
               <>
                  <p>
                     A <strong>presigned URL</strong> is a signed query-string
                     version of an S3 GET request — anyone with the link can
                     fetch the file until it expires. It&apos;s a bearer
                     token, so leaking the URL leaks the file.
                  </p>
                  <br />
                  <p>
                     A <strong>workspace invite</strong> ties access to a
                     logged-in user, which means you can revoke, audit who
                     opened what, and limit them to a prefix without minting
                     IAM users. S3 Viewer signs every request server-side
                     using your stored credentials; the recipient never sees
                     them.
                  </p>
               </>
            }
            faqs={faqs}
            useCases={getUseCaseRefs(["share-with-non-technical-users"])}
            related={getRelatedHowTos([
               "invite-teammate-to-s3-bucket",
               "set-granular-s3-permissions",
               "download-file-from-s3",
            ])}
         />
      </>
   );
};

Page.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default Page;
