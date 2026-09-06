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
      "> S3 Viewer is a free, open-source (MIT) web browser for S3-compatible object storage. Browse, preview, download, and share files across AWS S3, Cloudflare R2, Backblaze B2, MinIO, and other compatible endpoints. Available changes depend on the provider: uploads are supported on AWS S3 and R2, B2 uploads are blocked, and object rename/deletion are limited to AWS S3. Share buckets through team roles without exposing storage keys. Self-host with Docker or use the hosted app.",
      "",
      "Facts that answer most questions about the product:",
      "",
      "- Connects through S3 APIs. Provider compatibility and available actions differ; live AWS, R2, and B2 validation is still pending.",
      "- Connect with an access key ID, secret access key, endpoint URL, region, and optional session token. Custom regions are accepted; B2 regions can be derived from the endpoint. Credentials that cannot list buckets still work by naming the buckets they reach.",
      "- Credentials are encrypted in the browser with the server's public key before they are sent; the S3 Viewer server decrypts them only to sign requests.",
      "- Team access is by email invite with a per-bucket role (Viewer or Editor) and one-click revoke; teammates never see the underlying AWS keys.",
      "- Uploads stream through the server without bucket CORS configuration. AWS S3 and R2 uploads protect against overwriting an unreviewed file. Other endpoints must enforce those protections; B2 uploads are blocked pending verification.",
      "- Replacements require readable original permissions and settings. Unsupported encryption, encodings, or unavailable permission information block replacement. Some MinIO setups report placeholder owner information and cannot safely replace files through the app; upload under a new name instead.",
      "- Rename and object/selection/folder deletion are AWS S3 only, require the reviewed object's ETag, and reject changed objects. Rename is limited to 5 GB and requires readable settings; opaque encryption is blocked. R2, B2, and other endpoints stop before changing objects. The app never purges historical versions and does not promise zero data loss under concurrent external writes.",
      "- Copy link creates a download URL valid for up to 15 minutes; temporary credentials may expire sooner. Downloads go straight from the bucket. Search filters the current folder by prefix.",
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
      `- [Provider compatibility](${GITHUB_URL}/blob/main/PROVIDER-COMPATIBILITY.md): Supported actions, safety restrictions, and verification status for each provider.`,
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
