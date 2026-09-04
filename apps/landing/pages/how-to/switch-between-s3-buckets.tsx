import { getRelatedHowTos } from "@/components/HowTo/data";
import {
   createHowToPage,
   type HowToFAQ,
   type HowToStep,
} from "@/components/HowTo/how-to-page";
import { getUseCaseRefs } from "@/components/UseCases/data";
import { SwitchBucketsIllustration } from "@/components/UseCases/illustrations";

const SLUG = "switch-between-s3-buckets";
const TITLE = "How to switch between S3 buckets quickly";
const KEYWORD = "switch between S3 buckets";
const TLDR =
   "From the AWS CLI: configure named profiles in ~/.aws/credentials and switch with AWS_PROFILE — the right pattern for scripts. From the AWS console: navigate per-account and re-authenticate every time. From S3 Viewer: every connected server and its buckets sit in one sidebar, so switching between an AWS bucket and an R2 bucket is a click, with no sign-in in between.";

const steps: HowToStep[] = [
   {
      title: "In S3 Viewer: pick the server in the sidebar",
      body: (
         <>
            Every connection you have added with <strong>Add server</strong> is
            listed in the sidebar — AWS, R2, MinIO, anything you have wired up.
            Selecting one loads its buckets underneath it.
         </>
      ),
   },
   {
      title: "Click the bucket",
      body: (
         <>
            The file list swaps to that bucket&apos;s root. No re-authenticating
            and no profile switching — the credential for that server is already
            stored and is used to sign the request.
         </>
      ),
   },
   {
      title: "AWS CLI: named profiles",
      body: (
         <>
            Configure profiles in <code>~/.aws/credentials</code> and switch
            with <code>AWS_PROFILE</code>. The right pattern for scripts and
            single-shell workflows.
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
            Add each account&apos;s credentials as its own server. In S3 Viewer
            they are separate entries in the sidebar; in the CLI they are
            separate profiles.
         </>
      ),
   },
];

const faqs: HowToFAQ[] = [
   {
      question: "What's the fastest way to switch between AWS S3 buckets?",
      answer:
         "It depends on the workflow. For scripts, AWS CLI named profiles toggled with AWS_PROFILE are ideal. For interactive work where you bounce between many buckets in a session, a browser tool that keeps every bucket in one sidebar is faster — in S3 Viewer, switching bucket or provider is a click, with no profile switching and no re-authenticating.",
   },
   {
      question: "Can I have buckets from multiple AWS accounts open at once?",
      answer:
         "Yes. Add each AWS account as its own server — S3 Viewer keeps a separate credential and signer per server. Buckets are listed under the server they belong to, so you can tell them apart at a glance. You browse one server at a time and switch from the sidebar.",
   },
   {
      question: "How do I switch between AWS profiles in the CLI?",
      answer:
         "Set the AWS_PROFILE environment variable per command (AWS_PROFILE=acme aws s3 ls) or per shell (export AWS_PROFILE=acme). Profiles are configured in ~/.aws/credentials.",
   },
   {
      question: "Can I jump between an AWS bucket and a Cloudflare R2 bucket?",
      answer:
         "Yes. Add AWS and R2 as separate servers and both appear in the same sidebar; switching from one to the other is a click, with no re-authenticating, since each server keeps its own credential under the hood.",
   },
];

export default createHowToPage({
   slug: SLUG,
   title: TITLE,
   tldr: TLDR,
   keyword: KEYWORD,
   seoTitle: "How to Switch Between S3 Buckets Quickly",
   seoDescription:
      "Two patterns for switching between AWS S3 buckets without losing context: one sidebar of servers and buckets in S3 Viewer, or named profiles in the AWS CLI.",
   visual: <SwitchBucketsIllustration />,
   steps,
   underTheHood: (
      <p>
         The AWS CLI scopes credentials per profile (
         <code>~/.aws/credentials</code>) and you switch by setting{" "}
         <code>AWS_PROFILE</code>. That&apos;s the right pattern for scripts and
         single-shell workflows. For interactive sessions where you bounce
         between many buckets, the cost is not the switch itself but the
         re-authentication and the context loss around it. S3 Viewer keeps every
         server you have added in one sidebar and routes each click to that
         server&apos;s stored credential, so moving between an AWS bucket and an
         R2 bucket is the same gesture as moving between two folders.
      </p>
   ),
   faqs,
   useCases: getUseCaseRefs(["multi-cloud", "s3-browser"]),
   related: getRelatedHowTos([
      "view-s3-and-r2-side-by-side",
      "search-across-s3-buckets",
      "invite-teammate-to-s3-bucket",
   ]),
});
