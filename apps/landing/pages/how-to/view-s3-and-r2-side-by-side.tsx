import { getRelatedHowTos } from "@/components/HowTo/data";
import HowToPage, {
   type HowToFAQ,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import { buildHowToJsonLd } from "@/components/HowTo/jsonld";
import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { getUseCaseRefs } from "@/components/UseCases/data";
import { SideBySideIllustration } from "@/components/UseCases/illustrations";
import { SITE_URL } from "@/lib/site-config";

const SLUG = "view-s3-and-r2-side-by-side";
const TITLE = "How to view AWS S3 and Cloudflare R2 in one dashboard";
const KEYWORD = "view S3 and R2 together";
const TLDR =
   "Each provider's native console focuses on its own service — exactly what you'd expect. To work across them you need a third tool, and Cloudflare R2's S3-compatible API is what makes that possible: one S3 client can talk to both. In S3 Viewer you add each provider as its own server, and both sit in the sidebar. You browse one server at a time and switch between them from that list — no re-authenticating, no second console.";

const steps: HowToStep[] = [
   {
      title: "Add AWS S3",
      body: (
         <>
            Click <strong>Add server</strong> in the sidebar and paste an AWS
            access key and secret, then enter the region and endpoint for the
            bucket you want. S3 Viewer checks the credentials and lists the
            buckets they can reach.
         </>
      ),
   },
   {
      title: "Add Cloudflare R2",
      body: (
         <>
            In the Cloudflare dashboard, create an R2 API token. Back in S3
            Viewer, click <strong>Add server</strong> again and enter the access
            key, the secret, and your account&apos;s S3 endpoint
            (account.r2.cloudflarestorage.com). R2 uses <code>auto</code> as its
            region.
         </>
      ),
   },
   {
      title: "Both providers in the same sidebar",
      body: (
         <>
            Each connection is a server in the sidebar, named however you like —
            &ldquo;AWS prod&rdquo;, &ldquo;R2 assets&rdquo;. Add as many as you
            want: MinIO, B2, Wasabi, DigitalOcean Spaces and Tigris all connect
            the same way.
         </>
      ),
   },
   {
      title: "Switch between them from the sidebar",
      body: (
         <>
            Pick a server and its buckets load below it; pick another and you
            are in the other cloud. One server is active at a time, so you are
            always sure which provider you are looking at — and you never sign
            in again to get there.
         </>
      ),
   },
   {
      title: "Filter inside a folder",
      body: (
         <>
            The <strong>Filter by prefix</strong> box above the file list
            filters the current folder&apos;s rows by prefix. It works
            identically on an R2 bucket and an S3 bucket, because both answer
            the same <code>ListObjectsV2</code> call.
         </>
      ),
   },
   {
      title: "Moving objects between providers",
      body: (
         <>
            S3 Viewer does not copy across providers — <code>CopyObject</code>{" "}
            needs a shared endpoint. For a transfer, use{" "}
            <code>rclone sync</code> or the AWS CLI, then use S3 Viewer to check
            both sides. The separate guide below walks through it.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "Can I manage AWS S3 and Cloudflare R2 in one tool?",
      answer:
         "Yes. R2 implements the S3 API, so a single S3 client can talk to both. In S3 Viewer, add each provider as its own server with its own credential — both sit in the same sidebar and you switch between them in a click. Each provider's native console is focused on its own service, which is exactly what they're designed for; S3 Viewer is the layer for working across them.",
   },
   {
      question: "How does R2 work with the S3 API?",
      answer:
         "Cloudflare R2 exposes an S3-compatible endpoint at <account>.r2.cloudflarestorage.com. Any S3 client (the AWS SDKs, the AWS CLI with --endpoint-url, or S3 Viewer) can list, get, put and delete objects against R2 the same way it does against AWS S3. Cloudflare's investment in S3 compatibility is what makes a tool like S3 Viewer possible at all.",
   },
   {
      question: "Do I need separate credentials for each cloud?",
      answer:
         "Yes — one access key per cloud, added as its own server. S3 Viewer doesn't replace your AWS or Cloudflare accounts; it sits on top of them and signs requests with whichever server's credential you are browsing. Each is encrypted in your browser before it reaches us and decrypted only to run the operation you asked for.",
   },
   {
      question: "Can S3 Viewer copy a file from S3 to R2?",
      answer:
         "No. Cross-provider copy isn't something S3 Viewer does — S3's CopyObject requires the source and destination to share an endpoint, and we don't proxy object bytes. Use rclone or the AWS CLI for the transfer and S3 Viewer to browse and verify both buckets.",
   },
   {
      question: "Can I see both providers on screen at the same time?",
      answer:
         "Not side by side — one server is active at a time. Switching between them is a click in the sidebar, with no re-authentication, which covers most cross-referencing. If you genuinely need two views at once, open S3 Viewer in two browser tabs.",
   },
   {
      question: "Why use a third tool instead of two browser tabs?",
      answer:
         "Two provider consoles work fine if you're rarely in both. Once you cross-reference often, the context-switch cost adds up — separate logins, separate UIs, different conventions for the same operations. One dashboard with the same file browser over both keeps you in flow.",
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
            title="View AWS S3 and Cloudflare R2 in One Dashboard"
            description="Add AWS S3 and Cloudflare R2 as servers in one sidebar and switch between them in a click — one file browser over both S3-compatible APIs."
            canonical={`/how-to/${SLUG}`}
            jsonLd={jsonLd}
         />
         <HowToPage
            eyebrow={TITLE}
            title={TITLE}
            tldr={TLDR}
            visual={<SideBySideIllustration />}
            steps={steps}
            underTheHood={
               <p>
                  R2, B2, MinIO and Wasabi all implement the S3 API, which is
                  why a single client can talk to all of them — the only
                  differences are the endpoint, the region string and a few
                  signing nuances, which is why S3 Viewer asks you for the
                  region and endpoint when you add a server rather than
                  guessing. Each server keeps its own credential and its own
                  signer, so nothing crosses over between providers. You browse
                  one server at a time and switch from the sidebar. What S3
                  Viewer deliberately does not do is move bytes between
                  providers: <code>CopyObject</code> only works within one
                  endpoint, and proxying object data through our servers is not
                  something we want to be in the path of. Transfers belong to{" "}
                  <code>rclone</code> or the AWS CLI.
               </p>
            }
            faqs={faqs}
            useCases={getUseCaseRefs(["multi-cloud", "cloudflare-r2"])}
            related={getRelatedHowTos([
               "switch-between-s3-buckets",
               "copy-files-between-s3-and-r2",
               "search-across-s3-buckets",
            ])}
         />
      </>
   );
};

Page.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default Page;
