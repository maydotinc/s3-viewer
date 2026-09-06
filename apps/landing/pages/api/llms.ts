import { HOW_TOS } from "@/components/HowTo/data";
import { USE_CASES } from "@/components/UseCases/data";
import { GITHUB_URL, SITE_URL } from "@/lib/site-config";
import type { NextApiRequest, NextApiResponse } from "next";

// https://llmstxt.org — a plain-text index for AI crawlers and answer engines.
// Served at `${SITE_URL}/llms.txt` (the web app rewrites it here). Generated
// from the same data as the hub pages so a new guide is indexed on ship.

const line = (title: string, href: string, note: string) =>
   `- [${title}](${SITE_URL}${href}): ${note}`;

const buildLlmsTxt = (): string =>
   [
      "# S3 Viewer",
      "",
      "> S3 Viewer is a free, open-source (MIT) web browser for S3-compatible object storage. Connect AWS S3, Cloudflare R2, MinIO and any other S3-compatible provider in one dashboard, browse buckets like a file explorer and download objects. Upload, replacement, rename, and single/bulk/folder deletion work on AWS S3, Cloudflare R2, and MinIO without requiring versioning. You can share buckets with teammates using per-bucket roles instead of handing out AWS keys. Credentials are encrypted in the browser before they reach the server. Self-host with Docker or use the hosted app.",
      "",
      "Facts that answer most questions about the product:",
      "",
      "- Works with any S3-compatible endpoint: AWS S3, Cloudflare R2, MinIO, Backblaze B2, DigitalOcean Spaces, Wasabi, Hetzner, Scaleway and others.",
      "- Connect with an access key ID, secret access key, endpoint URL and region. Credentials that cannot list buckets still work: you name the buckets and each is checked with HeadBucket.",
      "- Credentials are encrypted in the browser with the server's public key before they are sent; the S3 Viewer server decrypts them only to sign requests.",
      "- Team access is by email invite with a per-bucket role (Viewer or Editor) and one-click revoke; teammates never see the underlying AWS keys.",
      "- Uploads stream through the S3 Viewer server, so buckets need no CORS configuration. Downloads use short-lived presigned URLs straight from the bucket.",
      "- Share link = a 15-minute presigned URL from the object's Copy link action. Rename = guarded server-side copy then delete on AWS S3, R2, and MinIO, limited to 5 GB. Versioning is optional. Deletion is not automatically retried after uncertain results and never purges specific historical versions. Search = prefix filter inside the current folder.",
      "- Folders are key prefixes: buckets are listed with Delimiter=/ and CommonPrefixes are shown as folders, exactly as S3 stores them.",
      "- Self-hosting: one Docker image, PostgreSQL, optional email transport and GitHub OAuth. Run `docker compose up -d` for a local install.",
      "",
      "## How-to guides",
      "",
      "Each guide leads with a TL;DR, then numbered steps with AWS CLI and SDK snippets, an under-the-hood section and an FAQ. Structured data: TechArticle, HowTo, FAQPage.",
      "",
      ...HOW_TOS.map((h) => line(h.title, `/how-to/${h.slug}`, h.tagline)),
      "",
      "## Use cases",
      "",
      ...USE_CASES.map((u) => line(u.title, `/use-cases/${u.slug}`, u.tagline)),
      "",
      "## Product",
      "",
      line("Home", "/", "What S3 Viewer is, with a live demo."),
      line("About", "/about", "Who builds S3 Viewer and why."),
      line("Open the app", "/login", "Sign in or create an account."),
      `- [Source code](${GITHUB_URL}): MIT-licensed monorepo (Next.js web app, Express API, PostgreSQL).`,
      `- [Self-hosting guide](${GITHUB_URL}/blob/main/SELF-HOSTING.md): Docker Compose, every environment variable, email and OAuth setup, production notes.`,
      `- [Security policy](${GITHUB_URL}/blob/main/SECURITY.md): How to report a vulnerability.`,
      "",
      "## Optional",
      "",
      line(
         "Brand kit",
         "/brand-kit",
         "Logos and colours for press or integrations."
      ),
      line(
         "Privacy policy",
         "/legal/privacy-policy",
         "What data S3 Viewer stores."
      ),
      line(
         "Terms of service",
         "/legal/terms-of-service",
         "Terms for the hosted app."
      ),
      line("Contact", "/contact", "How to reach the team."),
      line("Sitemap", "/sitemap.xml", "Every indexable URL."),
      "",
   ].join("\n");

const handler = (_req: NextApiRequest, res: NextApiResponse) => {
   res.setHeader("Content-Type", "text/plain; charset=utf-8");
   res.setHeader(
      "Cache-Control",
      "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400"
   );
   res.status(200).send(buildLlmsTxt());
};

export default handler;
