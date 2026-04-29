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
   "Two patterns. Generate a presigned URL — a time-limited bearer link that works in any browser without an AWS account. Or invite the recipient to an S3 Viewer workspace by email — tied to a logged-in user, scoped per bucket, revocable in one click. Use presigned URLs for one-off shares; use workspace invites for ongoing access.";

const steps: HowToStep[] = [
   {
      title: "Decide: one-time or ongoing access?",
      body: (
         <>
            <strong>One-time</strong>: a presigned URL is the right tool —
            short-lived, no signup, works in any browser.{" "}
            <strong>Ongoing</strong>: a workspace invite is safer — tied
            to a logged-in user, revocable in one click, scoped per bucket.
         </>
      ),
   },
   {
      title: "One-time: presigned URL via the AWS CLI",
      body: (
         <>
            The link works in any browser and expires after the duration
            you set (max 7 days with IAM user keys). It&apos;s a bearer
            token — anyone who gets the link can use it until it expires,
            and it can&apos;t be revoked once shared.
         </>
      ),
      code: "aws s3 presign s3://my-bucket/contract.pdf --expires-in 3600",
   },
   {
      title: "One-time: presigned URL in S3 Viewer",
      body: (
         <>
            Right-click the file and choose Share link. S3 Viewer signs
            the URL server-side using your stored credentials and copies
            it to your clipboard. Same primitive as the CLI — in a UI you
            can hand to a junior teammate.
         </>
      ),
   },
   {
      title: "Ongoing: invite them to your workspace",
      body: (
         <>
            Click Invite on the bucket. Type the recipient&apos;s email,
            choose Viewer (read + download only), Editor (read + write),
            or Admin. They sign in to S3 Viewer with email OTP or GitHub
            and see only the bucket you shared.
         </>
      ),
   },
   {
      title: "Pick a role per bucket",
      body: (
         <>
            Roles are assigned per bucket — same person can be Viewer on
            one and Editor on another. Simpler to operate than authoring
            per-person IAM users with hand-rolled JSON policies.
         </>
      ),
   },
   {
      title: "Revoke when done",
      body: (
         <>
            One click. Their session ends and the workspace stops signing
            S3 calls for them — no IAM key rotation needed because no IAM
            user was ever minted for them.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "How do I send an S3 file to a client who doesn't use AWS?",
      answer:
         "Quickest: generate a presigned URL with `aws s3 presign s3://bucket/key --expires-in 3600` (or right-click → Share link in S3 Viewer). The link works in any browser and expires when you say. For repeat access, invite them to an S3 Viewer workspace by email — they sign in once and see only the bucket you shared, with no AWS account, IAM user, or CLI required.",
   },
   {
      question: "Are presigned URLs safe to share?",
      answer:
         "Safe enough for short-lived sharing — they expire and don't expose your credentials. Less ideal for ongoing access: anyone who gets the link can use it until it expires, it can't be revoked once shared, and there's no record of who actually downloaded the file. For ongoing access, S3 Viewer's workspace invites are the right primitive — revocable, tied to a user, no permanent IAM artifacts.",
   },
   {
      question: "How long can a presigned URL last?",
      answer:
         "AWS allows presigned URLs to last up to 7 days when signed with IAM user credentials, or up to the session length when signed with temporary credentials (typically 1 hour for STS). Shorter is safer. S3 Viewer issues 15-minute URLs for downloads to keep the blast radius small.",
   },
   {
      question: "Can I revoke a presigned URL after sharing it?",
      answer:
         "Not directly. The options are to wait for it to expire, rotate the signing key (which invalidates every other URL signed with that key), or delete the underlying object. This is why workspace invites exist — they're tied to a session, not a token, so revoking takes one click and breaks nothing else.",
   },
   {
      question: "Can the recipient upload back to me?",
      answer:
         "Yes — presigned URLs can be issued for PUT as well, but they're clunky for repeat use. In S3 Viewer, give them the Editor role on the bucket and they can upload through the file browser.",
   },
   {
      question: "Does this work with Cloudflare R2 too?",
      answer:
         "Yes. R2 supports the same S3 presigned URL pattern, and S3 Viewer's workspace invites work identically against R2 buckets — useful when you want to share an R2 bucket with someone who doesn't have a Cloudflare account.",
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
            description="Two ways to share AWS S3 and Cloudflare R2 files with people who don't use AWS: a presigned URL for one-off sharing, or a workspace invite for revocable ongoing access."
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
                     A <strong>presigned URL</strong> is a signed
                     query-string version of an S3 GET request. Anyone with
                     the link can fetch the file until it expires (max 7
                     days with IAM user keys). It&apos;s a bearer token —
                     leaking the URL leaks the file, and it can&apos;t be
                     revoked once it&apos;s out.
                  </p>
                  <br />
                  <p>
                     A <strong>workspace invite</strong> ties access to a
                     logged-in user, which means you can revoke at any
                     time, limit them to specific buckets, and avoid
                     minting IAM users. S3 Viewer signs every request
                     server-side using the workspace&apos;s stored
                     credentials (encrypted at rest with RSA-4096); the
                     recipient never sees an access key. Off-boarding is
                     a one-click revoke — no AWS keys to rotate because
                     no IAM user was ever created.
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
