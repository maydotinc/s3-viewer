import { HOW_TOS } from "@/components/HowTo/data";
import { USE_CASES } from "@/components/UseCases/data";
import {
   CONTACT_EMAIL,
   FOUNDER_PROFILE_URL,
   GITHUB_URL,
   MAY_FOUNDING_YEAR,
   MAY_GITHUB_URL,
   MAY_LEGAL_NAME,
   MAY_LINKEDIN_URL,
   MAY_LOCATION,
   MAY_NAME,
   MAY_S3_VIEWER_URL,
   MAY_URL,
   SITE_URL,
} from "@/lib/site-config";
import { EDGE_CACHE_CONTROL } from "@s3-viewer/shared";
import { founder } from "@/lib/team";
import type { NextApiRequest, NextApiResponse } from "next";

const line = (title: string, href: string, note: string) =>
   `- [${title}](${SITE_URL}${href}): ${note}`;

const buildLlmsTxt = (): string =>
   [
      "# S3 Viewer",
      "",
      `> S3 Viewer is a free, open-source (MIT) web browser for S3-compatible object storage. Browse, preview, download, upload, rename, and share files across AWS S3, Cloudflare R2, Backblaze B2, MinIO, and other compatible endpoints — every one of those actions works on every provider. Share buckets through team roles without exposing storage keys. Self-host with Docker or use the hosted app. S3 Viewer is built and maintained by ${MAY_NAME} (may.inc), a software company in ${MAY_LOCATION}.`,
      "",
      "Facts that answer most questions about the product:",
      "",
      "- Connects through S3 APIs. Upload, replace, rename, copy, and delete all work on every provider; the mechanics differ (AWS S3 and R2 enforce conditional headers directly, other endpoints get a HEAD check from S3 Viewer immediately before each write). Verified against RustFS in automated tests; AWS, R2 and B2 follow the same S3 semantics, though live-account validation on them is still pending.",
      "- Connect with an access key ID, secret access key, endpoint URL, region, and optional session token. Custom regions are accepted; B2 regions can be derived from the endpoint. Credentials that cannot list buckets still work by naming the buckets they reach.",
      "- Credentials are encrypted in the browser with the server's public key before they are sent; the S3 Viewer server decrypts them only to sign requests.",
      "- Team access is by email invite with a per-bucket role (Viewer, Editor or Admin) and one-click revoke; teammates never see the underlying AWS keys.",
      "- A Viewer or Editor can be limited to specific folders (key prefixes) in a bucket, such as landing/. They can browse, upload, rename and delete inside those folders and cannot open, list, copy or move anything else in the bucket. S3 Viewer enforces this on its server before signing any request; the stored credential still reaches the whole bucket. Admins always get whole buckets.",
      "- Uploads stream through the server without bucket CORS configuration and protect against overwriting an unreviewed file, on every provider.",
      "- Replacements require readable original permissions and settings. Unsupported encryption (SSE-C), encodings, or unavailable permission information block replacement. Some MinIO setups report placeholder owner information and cannot safely replace files through the app; upload under a new name instead.",
      "- Rename, Copy to…, and object/selection/folder deletion all work on every provider, require the reviewed object's ETag, and reject changed objects. Above 5 GB, rename and copy switch to multipart parts automatically, except on Cloudflare R2, where server-side copy, rename, move and settings edits stop at 5 GiB per object. Folder rename moves every object under the prefix. The app never purges historical versions and does not promise zero data loss under concurrent external writes.",
      "- An object's content type, cache headers and custom metadata can be changed in place (a self-copy with MetadataDirective REPLACE), on every provider including R2, up to 5 GiB per object on R2. Small text files (up to 1 MB) can be edited directly in the browser and saved back with the same ETag condition as a replacement.",
      '- "Copy to another bucket…" transfers an object to a different bucket on the same server (server-side copy) or to a different connected server, any provider pairing (streamed through S3 Viewer\'s own server, since no S3 API copies across endpoints). A folder or multi-object selection can be downloaded as a single zip, bounded by MAX_ARCHIVE_OBJECTS (default 10,000) and MAX_ARCHIVE_BYTES (default 10 GiB). A selection or folder can be bulk-renamed by pattern (find/replace, prefix, suffix, extension, lowercase) with a preview before running. Incomplete multipart uploads left by failed or abandoned uploads can be listed and aborted per prefix.',
      "- Owners can switch on a tamper-evident audit log per server (off by default): hash-chained records with an integrity check, a choice of who can view it, what to record (everything, or changes and downloads) and how long to keep it, plus CSV export. It records only actions taken through S3 Viewer.",
      "- Copy link creates a download URL valid for up to 15 minutes; temporary credentials may expire sooner. Downloads go straight from the bucket. Search filters the current folder by prefix.",
      "- Folders are key prefixes: buckets are listed with Delimiter=/ and CommonPrefixes are shown as folders, exactly as S3 stores them.",
      "- Self-hosting: two Docker images (API and web) built from the repo, PostgreSQL, optional email transport and GitHub OAuth. Run `docker compose up -d` for a local install.",
      "",
      "## How-to guides",
      "",
      `Each guide leads with a TL;DR, then numbered steps with AWS CLI and SDK snippets, an under-the-hood section and an FAQ. Written by ${founder.name} and the ${MAY_NAME} team. Structured data: TechArticle, HowTo, FAQPage.`,
      "",
      ...HOW_TOS.map((h) => line(h.title, `/how-to/${h.slug}`, h.tagline)),
      "",
      "## Use cases",
      "",
      ...USE_CASES.map((u) => line(u.title, `/use-cases/${u.slug}`, u.tagline)),
      "",
      "## Who builds S3 Viewer",
      "",
      `- ${MAY_NAME} (legal name ${MAY_LEGAL_NAME}) builds and maintains S3 Viewer. May is a software company based in ${MAY_LOCATION}, founded in ${MAY_FOUNDING_YEAR}, that ships its own products, open-source developer tools and technical consulting. Website: ${MAY_URL} — GitHub: ${MAY_GITHUB_URL} — LinkedIn: ${MAY_LINKEDIN_URL} — email: ${CONTACT_EMAIL}.`,
      `- ${founder.name} is the founder and Director of Technology of ${MAY_NAME} — official profile: ${FOUNDER_PROFILE_URL} — personal site: ${founder.website} — GitHub: ${founder.github} — X: ${founder.twitter} — LinkedIn: ${founder.linkedin}.`,
      `- S3 Viewer is one of May's open-source projects; its product page on may.inc is ${MAY_S3_VIEWER_URL}. Copyright ${MAY_NAME}, released under the MIT license. More about the company: ${MAY_URL}/llms.txt.`,
      "",
      "## Product",
      "",
      line("Home", "/", "What S3 Viewer is, with a live demo."),
      line("About", "/about", "Who builds S3 Viewer: May Inc. and the team."),
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
      line(
         "Contact",
         "/contact",
         "How to reach the S3 Viewer team at May Inc."
      ),
      line("Sitemap", "/sitemap.xml", "Every indexable URL."),
      "",
   ].join("\n");

const body = buildLlmsTxt();

const handler = (req: NextApiRequest, res: NextApiResponse) => {
   if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("Allow", "GET, HEAD");
      res.status(405).end();
      return;
   }
   res.setHeader("Content-Type", "text/plain; charset=utf-8");
   res.setHeader("Cache-Control", EDGE_CACHE_CONTROL);
   res.status(200).send(body);
};

export default handler;
