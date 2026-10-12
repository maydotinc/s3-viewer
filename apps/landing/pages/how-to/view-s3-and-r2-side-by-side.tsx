import {
   createHowToPage,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import type { Faq } from "@/lib/types";
import { SideBySideIllustration } from "@/components/UseCases/illustrations/how-to/side-by-side";

const SLUG = "view-s3-and-r2-side-by-side";
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
            <strong>Copy to another bucket…</strong> copies a file, folder, or
            selection to any connected server, streaming the bytes through S3
            Viewer because <code>CopyObject</code> needs a shared endpoint. For
            a large or repeated migration, use <code>rclone sync</code> or the
            AWS CLI. The separate guide below walks through both.
         </>
      ),
   },
];

const faqs: Faq[] = [
   {
      question: "Can I manage AWS S3 and Cloudflare R2 in one tool?",
      answer:
         "Yes. R2 implements the S3 API, so a single S3 client can talk to both. In S3 Viewer, add each provider as its own server with its own credential — both sit in the same sidebar and you switch between them in a click. Each provider's native console is focused on its own service, which is exactly what they're designed for; S3 Viewer is the layer for working across them.",
   },
   {
      question: "How does R2 work with the S3 API?",
      answer:
         "Cloudflare R2 exposes an S3-compatible endpoint at <account>.r2.cloudflarestorage.com. S3 Viewer uses it to browse, preview, download, upload, rename, and share files, the same as it does on AWS S3. The mechanics differ under the hood — R2 lacks a delete-time condition, so S3 Viewer checks with a HEAD request immediately before deleting or renaming rather than relying on R2 to enforce it — but the actions themselves are the same.",
   },
   {
      question: "Do I need separate credentials for each cloud?",
      answer:
         "Yes — one access key per cloud, added as its own server. S3 Viewer doesn't replace your AWS or Cloudflare accounts; it sits on top of them and signs requests with whichever server's credential you are browsing. Each is encrypted in your browser before it reaches us and decrypted only to run the operation you asked for.",
   },
   {
      question: "Can S3 Viewer copy a file from S3 to R2?",
      answer:
         "Yes. Use “Copy to another bucket…” on a file, folder, or selection and pick the R2 server as the destination; S3 Viewer streams the bytes through its own server. For a large or repeated migration, rclone or the AWS CLI is still the better tool.",
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

export default createHowToPage({
   slug: SLUG,
   tldr: TLDR,
   seoTitle: "View AWS S3 and Cloudflare R2 in One Dashboard",
   seoDescription:
      "Add AWS S3 and Cloudflare R2 as servers in one sidebar and switch between them in a click — one file browser over both S3-compatible APIs.",
   published: "2026-04-28",
   visual: <SideBySideIllustration />,
   steps,
   underTheHood: (
      <p>
         R2, B2, MinIO, and other compatible endpoints share the same file
         browser and the same actions — upload, replace, rename, delete — but
         the mechanics underneath differ. AWS S3 and R2 enforce the conditional
         headers S3 Viewer sends; B2 and other endpoints aren&apos;t verified
         to, so S3 Viewer checks with a HEAD request immediately before each
         mutating call instead. Replacements need readable original permissions
         and settings on every provider. Each connection keeps its own
         credentials, and you switch servers in the sidebar. Transfers between
         providers stream through S3 Viewer; bulk migrations belong to{" "}
         <code>rclone</code> or the AWS CLI.
      </p>
   ),
   faqs,
   useCases: ["multi-cloud", "cloudflare-r2"],
   related: [
      "switch-between-s3-buckets",
      "copy-files-between-s3-and-r2",
      "search-across-s3-buckets",
   ],
});
