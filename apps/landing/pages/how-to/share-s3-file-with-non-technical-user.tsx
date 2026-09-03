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
   "Two patterns. Copy a presigned URL — a time-limited bearer link that works in any browser without an AWS account; S3 Viewer's Copy link gives you one that lasts 15 minutes. Or invite the recipient to the server by email — tied to a logged-in user, given a role, revocable in one click. Use a link for one-off shares; use an invite for ongoing access.";

const steps: HowToStep[] = [
   {
      title: "Decide: one-time or ongoing access?",
      body: (
         <>
            <strong>One-time</strong>: a presigned URL is the right tool —
            short-lived, no signup, works in any browser.{" "}
            <strong>Ongoing</strong>: an email invite to the server is safer —
            tied to a logged-in user, given a role, revocable in one click.
         </>
      ),
   },
   {
      title: "One-time: presigned URL via the AWS CLI",
      body: (
         <>
            The link works in any browser and expires after the duration you set
            (max 7 days with IAM user keys). It&apos;s a bearer token — anyone
            who gets the link can use it until it expires, and it can&apos;t be
            revoked once shared.
         </>
      ),
      code: "aws s3 presign s3://my-bucket/contract.pdf --expires-in 3600",
   },
   {
      title: "One-time: Copy link in S3 Viewer",
      body: (
         <>
            Open the ⋮ menu on the object&apos;s row and choose{" "}
            <strong>Copy link</strong>. S3 Viewer signs a presigned URL
            server-side with the server&apos;s stored credentials and puts it on
            your clipboard. It is valid for <strong>15 minutes</strong> — long
            enough to paste into a message, short enough that a leaked link
            stops working quickly.
         </>
      ),
   },
   {
      title: "Ongoing: invite them to the server",
      body: (
         <>
            Open the server&apos;s bucket list and click <strong>Share</strong>{" "}
            to open the members dialog. Type the recipient&apos;s email and
            choose <strong>Viewer</strong> (browse and download),{" "}
            <strong>Editor</strong> (also upload, rename and delete) or{" "}
            <strong>Admin</strong> (also manage members and buckets). They sign
            in with the code and sign-in link we email them — or with GitHub, if
            it is enabled — and see the buckets on that server.
         </>
      ),
   },
   {
      title: "Roles are per server, and per bucket where you need it",
      body: (
         <>
            A member&apos;s role on the server is their baseline, and a bucket
            can give the same person a different role. Simpler to operate than
            authoring per-person IAM users with hand-rolled JSON policies.
         </>
      ),
   },
   {
      title: "Revoke when done",
      body: (
         <>
            Remove them from the members dialog. They stop being able to reach
            the server on their next request — no IAM key rotation needed,
            because no IAM user was ever minted for them.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "How do I send an S3 file to a client who doesn't use AWS?",
      answer:
         "Quickest: open the ⋮ menu on the file in S3 Viewer and choose Copy link — that's a presigned URL valid for 15 minutes, and it works in any browser. From the CLI the equivalent is `aws s3 presign s3://bucket/key --expires-in 3600`. For repeat access, invite them to the server by email — they sign in once and see the buckets you gave them, with no AWS account, IAM user or CLI required.",
   },
   {
      question: "Are presigned URLs safe to share?",
      answer:
         "Safe enough for short-lived sharing — they expire and don't expose your credentials. Less ideal for ongoing access: anyone who gets the link can use it until it expires, it can't be revoked once shared, and there's no record of who actually downloaded the file. For ongoing access, an email invite is the right primitive — revocable, tied to a signed-in user, no permanent IAM artifacts.",
   },
   {
      question: "How long can a presigned URL last?",
      answer:
         "AWS allows presigned URLs to last up to 7 days when signed with IAM user credentials, or up to the session length when signed with temporary credentials (typically 1 hour for STS). Shorter is safer. Every URL S3 Viewer issues — Copy link, downloads, previews, upload parts — lasts 15 minutes, and that is not configurable.",
   },
   {
      question: "Can I revoke a presigned URL after sharing it?",
      answer:
         "Not directly. The options are to wait for it to expire, rotate the signing key (which invalidates every other URL signed with that key), or delete the underlying object. This is why invites exist — access is tied to a signed-in user, not a token, so revoking takes one click and breaks nothing else. S3 Viewer's links expire after 15 minutes, which keeps the window small.",
   },
   {
      question: "Can the recipient upload back to me?",
      answer:
         "Yes — presigned URLs can be issued for PUT as well, but they're clunky for repeat use. In S3 Viewer, give them the Editor role and they can upload through the file browser.",
   },
   {
      question: "Does this work with Cloudflare R2 too?",
      answer:
         "Yes. R2 supports the same S3 presigned URL pattern, and invites work identically on a server pointed at R2 — useful when you want to share an R2 bucket with someone who doesn't have a Cloudflare account.",
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
            description="Two ways to share AWS S3 and Cloudflare R2 files with people who don't use AWS: a 15-minute presigned link, or an email invite you can revoke."
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
                     version of an S3 GET request. Anyone with the link can
                     fetch the file until it expires (max 7 days with IAM user
                     keys; S3 Viewer issues 15-minute ones). It&apos;s a bearer
                     token — leaking the URL leaks the file, and it can&apos;t
                     be revoked once it&apos;s out.
                  </p>
                  <br />
                  <p>
                     An <strong>invite</strong> ties access to a logged-in user,
                     which means you can revoke at any time, give them a role,
                     and avoid minting IAM users. S3 Viewer signs every request
                     server-side with the server&apos;s stored credentials —
                     encrypted in your browser before they reach us — so the
                     recipient never sees an access key. Off-boarding is a
                     one-click revoke: no AWS keys to rotate, because no IAM
                     user was ever created.
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
