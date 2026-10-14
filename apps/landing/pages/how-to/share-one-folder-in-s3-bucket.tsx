import {
   createHowToPage,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import type { Faq } from "@/lib/types";
import { ShareFolderIllustration } from "@/components/UseCases/illustrations/how-to/share-folder";

const SLUG = "share-one-folder-in-s3-bucket";
const TLDR =
   "An S3 folder is a key prefix ending in a slash, and neither the AWS S3 console nor the Cloudflare R2 dashboard can share one with a person: AWS can only restrict an IAM identity to a prefix, and R2 tokens stop at the bucket. To give a colleague or client one folder without creating IAM users, connect the bucket to S3 Viewer once, invite them by email, and on the Access step switch the bucket from Whole bucket to Specific folders and add the folder, such as landing/. They see only that folder, nothing else in the bucket is listed or openable, and you change or remove the access later under Settings, Members without rotating any keys.";

const iamPolicy = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ObjectsInsideFolder",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::my-bucket/reports/*"
    },
    {
      "Sid": "ListOnlyThatFolder",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::my-bucket",
      "Condition": {
        "StringLike": { "s3:prefix": ["reports/*"] }
      }
    }
  ]
}`;

const steps: HowToStep[] = [
   {
      title: "Connect the bucket's server once",
      body: (
         <>
            Click <strong>Add server</strong> in the sidebar and paste one
            least-privilege credential for the S3 or R2 endpoint, typically with{" "}
            <code>s3:ListBucket</code>, <code>s3:GetObject</code>,{" "}
            <code>s3:PutObject</code> and <code>s3:DeleteObject</code> on the
            buckets you want to expose. This is the only key anyone creates; the
            people you invite sign in to S3 Viewer, not to AWS or Cloudflare.
         </>
      ),
   },
   {
      title: "Open Settings, Invites and add the people",
      body: (
         <>
            Click <strong>Invite people</strong>, type up to five email
            addresses, and tick the server (or servers) they should see. One
            send can cover several people and several servers; each person gets
            one email, and the invite is valid for seven days.
         </>
      ),
   },
   {
      title: "On the Access step, switch the bucket to Specific folders",
      body: (
         <>
            Pick a role, <strong>Viewer</strong> (browse and download) or{" "}
            <strong>Editor</strong> (also upload, rename and delete). Then, next
            to the bucket, change <em>Whole bucket</em> to{" "}
            <em>Specific folders</em> and add the prefixes they should reach,
            such as <code>landing/</code> or <code>reports/2026/</code>. A
            folder is a key prefix ending in <code>/</code>. It does not have to
            exist yet, a parent folder covers everything under it, and you can
            list up to 20 folders per bucket. Only Viewers and Editors can be
            limited this way; an Admin always gets the whole bucket.
         </>
      ),
      code: `landing/
reports/2026/`,
   },
   {
      title: "Review and send",
      body: (
         <>
            The last step shows each person, each server, the role and the
            folders before anything is sent. If you are an Admin rather than the
            Owner, you can only share folders you can open yourself. The
            recipient accepts the invite, signs in, and the bucket appears in
            their sidebar showing only the folders that lead to what they were
            given.
         </>
      ),
   },
   {
      title: "Change or remove the access later",
      body: (
         <>
            Under <strong>Settings, Members</strong> you can add or drop
            folders, widen the limit back to the whole bucket, change the role,
            or remove the person. The change applies on their next request. No
            key is rotated, because they never held one.
         </>
      ),
   },
   {
      title: "If you must do it in AWS instead",
      body: (
         <>
            Use this when the limit has to hold for a program, a service, or
            anyone who will use their own access keys. Create an IAM user or
            role for them and attach a policy with two statements: object
            actions on the prefix wildcard, and <code>s3:ListBucket</code> on
            the bucket itself with a <code>Condition</code> on{" "}
            <code>s3:prefix</code>. The listing condition is the part most first
            attempts miss. You then hand over access keys, and off-boarding
            means deleting the user and rotating anything they touched. On
            Cloudflare R2, a standard API token can be scoped to a bucket but
            not to a folder; prefix limits exist only on temporary credentials
            minted through the API.
         </>
      ),
      code: iamPolicy,
   },
];

const faqs: Faq[] = [
   {
      question: "Can I share just one folder of an S3 bucket?",
      answer:
         "Not from the AWS console or the Cloudflare R2 dashboard: neither has a way to share a folder with a person, and there is no invite-by-email anywhere in S3 or R2. In AWS you can restrict an IAM user or role to a prefix with a policy, which means one identity and one set of keys per person. With S3 Viewer you connect the bucket once, invite the person by email, and on the Access step switch the bucket from Whole bucket to Specific folders and add the folder. They see only that folder.",
   },
   {
      question: "Does S3 have real folders?",
      answer:
         "No. An S3 bucket is a flat list of object keys, and a folder is a key prefix that ends in a slash, such as landing/ in landing/hero.png. Consoles and S3 Viewer show those shared prefixes as folders by listing with a delimiter, but there is no directory object with its own permissions. That is why folder-level access has to be enforced by a policy on the key pattern or by an application in front of the bucket.",
   },
   {
      question: "Can I give someone access to a folder without an IAM user?",
      answer:
         "Yes, as long as that someone is a person using a browser. S3 Viewer signs every request on its server with the one credential you connected, and checks the person's role and folder limit before signing. The person never holds a key, so there is no IAM user to create or delete. If the limit also has to hold for scripts or an application using its own keys, keep an IAM prefix policy for that identity too.",
   },
   {
      question: "Can Cloudflare R2 tokens be limited to a folder?",
      answer:
         "A standard R2 account API token can be scoped to specific buckets with Object Read & Write or Object Read only, but not to a prefix, and Admin permissions are account-wide. R2 does support temporary credentials restricted with prefixPaths or objectPaths, which are short-lived S3-style keys minted through the API for a program to use, with a one-hour TTL by default. There is nothing in the dashboard that hands a folder to a colleague. S3 Viewer's folder limit works the same on R2 as on S3.",
   },
   {
      question: "What happens if the folder does not exist yet?",
      answer:
         "The limit still saves. A folder is only a prefix, so S3 Viewer does not need an object there to record it, and the access applies as soon as files land under that prefix. Until then the person sees an empty folder. This is useful for a client upload area you want ready before the first file arrives.",
   },
   {
      question: "Can an Admin be limited to a folder?",
      answer:
         "No. Admins manage members and buckets, so they always get whole buckets, and the Specific folders choice is only offered for Viewers and Editors. An Admin who invites someone can only share folders they can open themselves, which keeps a folder-limited Admin on a different server from widening anyone else's access.",
   },
   {
      question: "Does the person see the rest of the bucket?",
      answer:
         "No. They see the folders that lead to what they were given, for example the bucket and then landing/, and nothing else is listed or openable. Objects outside their folders cannot be opened, listed, copied or moved, including as the destination of a copy. The check happens on S3 Viewer's server before any request is signed, so the browser never receives the rest of the listing.",
   },
   {
      question: "How do I remove their access later?",
      answer:
         "Open Settings, Members, find the person and either edit their folders or remove them from the server. The change applies on their next request, other members are unaffected, and no AWS or Cloudflare keys need rotating because they never had any. A download link they already opened keeps working for up to 15 minutes.",
   },
];

export default createHowToPage({
   slug: SLUG,
   tldr: TLDR,
   seoTitle: "Share One Folder in an S3 Bucket (Not the Whole Bucket)",
   seoDescription:
      "Give someone access to one folder in an S3 or R2 bucket, not the whole bucket: what the consoles can do, the IAM prefix policy, and an email invite limited to specific folders.",
   published: "2026-10-14",
   visual: <ShareFolderIllustration />,
   steps,
   underTheHood: (
      <>
         <p>
            S3 stores a flat list of keys. What looks like a folder is every key
            that starts with the same prefix, and a listing with{" "}
            <code>Delimiter=/</code> collapses those shared prefixes into folder
            rows. Because there is no directory object, there is nothing to
            attach a share to. AWS answers this with IAM: a policy can allow{" "}
            <code>s3:GetObject</code> on <code>bucket/reports/*</code> and{" "}
            <code>s3:ListBucket</code> with an <code>s3:prefix</code> condition,
            but only for an IAM user, role or federated identity, so every
            person needs an identity, a key and an off-boarding step. Presigned
            URLs share one object for a limited time, not a folder. Cloudflare
            R2 scopes standard tokens to buckets, and its prefix-restricted
            temporary credentials are minted through the API for programs rather
            than handed out from the dashboard. Both are the right tools for
            services. The gap is a colleague, a client or a contractor who needs
            one folder and a browser.
         </p>
         <p>
            S3 Viewer fills that gap in front of the bucket. The bucket is
            connected once with a server-level credential, and each invited
            person has a role plus, for Viewers and Editors, an optional list of
            up to 20 folders per bucket. Every request is checked on S3
            Viewer&apos;s server before it is signed: a listing is only run
            under an allowed prefix, the parent folders that lead there are
            shown so the person can navigate, and an object outside the allowed
            folders cannot be read, written, listed, copied or moved, on either
            end of a copy. A folder is recorded as a prefix, so it does not need
            to exist first, and a parent covers every child under it.
         </p>
         <p>
            The limit lives in S3 Viewer, not in your provider. The stored
            credential still reaches the whole bucket, and members never see it,
            which is why changing or removing someone under Settings, Members
            takes effect on their next request with no key rotation. It also
            means the limit covers the browser, not programs with their own
            keys; when it has to hold there too, pair it with the IAM policy
            above. The same model works for Cloudflare R2 and any other
            S3-compatible provider.
         </p>
      </>
   ),
   faqs,
   useCases: ["share-with-non-technical-users", "teams"],
   related: [
      "invite-teammate-to-s3-bucket",
      "set-granular-s3-permissions",
      "share-s3-file-with-non-technical-user",
   ],
});
