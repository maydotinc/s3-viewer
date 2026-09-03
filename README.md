# S3 Viewer 🪣

A web-based S3-compatible object storage browser that lets you manage multiple S3 servers through a modern interface, with the familiarity of a traditional file explorer.

<img src="./apps/landing/public/landing/bucketview.png" alt="S3 Viewer showing a bucket listing with folders, objects and the row actions menu" width="100%">

## 📝 Features

- Connect to multiple S3-compatible providers (AWS S3, Cloudflare R2, MinIO, etc.)
- Credentials encrypted in the browser before they ever reach the server
- Server sharing and collaboration, with per-bucket access grants
- Multi-user support with role-based permissions
- File upload/download with progress tracking

## 🧬 Architecture

- **Frontend**: Next.js with shadcn/ui components (`apps/web`)
- **Landing**: Next.js marketing site (`apps/landing`)
- **Backend**: Express.js API (`apps/api`)
- **Database**: PostgreSQL with Prisma ORM (`packages/db`)
- **Authentication**: Better Auth (`packages/auth`)
- **Local dev URLs**: [Portless](https://portless.sh)
- **Monorepo**: Turborepo with pnpm workspaces
- **Object data path**: uploads stream through the API so buckets need no CORS configuration; downloads use short-lived presigned URLs.

## ✅ Prerequisites

- Node.js 20+ (`.nvmrc` pins 20)
- pnpm 10 (`corepack enable` is enough)
- PostgreSQL database
- OpenSSL (for key generation)

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/maydotinc/s3-viewer
cd s3-viewer
pnpm install
```

### 2. Local HTTPS via Portless

Dev URLs are stable HTTPS hostnames via [Portless](https://portless.sh):

- Web → `https://web.localhost`
- Landing → `https://landing.localhost`
- API → `https://api.localhost`

Run once on a fresh machine:

```bash
pnpm bootstrap
```

This installs `portless` globally, trusts its local CA, and starts the proxy on port 443 (one `sudo` prompt). Everything stays on `127.0.0.1`.

If you can't / don't want to use sudo, run `portless proxy start --https` instead — it binds to `:1355`. You'll then need to append `:1355` to every URL in your `.env` files and to the GitHub OAuth callback.

HTTPS is not optional in development: when `NEXT_PUBLIC_API_URL` is an `https://` URL the session cookie is issued with `Secure`, and the browser drops a `Secure` cookie sent over plain HTTP.

### 3. Generate Encryption Keys

Server credentials are encrypted with an RSA key pair — the public half lives in the web app, the private half only in the API. The API refuses to start on anything smaller than 2048 bits; 4096 is what we ship with:

```bash
openssl genrsa -out private_key.pem 4096
openssl rsa -pubout -in private_key.pem -out public_key.pem
```

### 4. ⚙️ Environment

There are three `.env` files — `apps/api/.env`, `apps/web/.env` and `apps/landing/.env` — each copied from the `.env.example` next to it:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/landing/.env.example apps/landing/.env
```

Users only ever see two hosts: the web app at `s3-viewer.com` and the API at `api.s3-viewer.com`.
The landing site is deployed separately on a hidden origin (a `*.vercel.app` URL) and the web app proxies the marketing routes from it, so it never appears in a URL.
Local dev mirrors this with the Portless hostnames: `web.localhost`, `api.localhost` and `landing.localhost`.

`apps/api/.env` (validated on startup by `apps/api/lib/env.ts`):

| Variable                 | Required | Local value               | Production value            | What it does                                                                        |
| ------------------------ | :------: | ------------------------- | --------------------------- | ----------------------------------------------------------------------------------- |
| `DATABASE_URL`           |    ✅    | `postgresql://…`          | `postgresql://…`            | PostgreSQL connection string for Prisma.                                            |
| `BETTER_AUTH_SECRET`     |    ✅    | `openssl rand -base64 32` | `openssl rand -base64 32`   | Signs sessions and tokens; at least 32 characters.                                  |
| `ENCRYPTION_PRIVATE_KEY` |    ✅    | `private_key.pem`         | `private_key.pem`           | RSA private key (2048 bits or more) that decrypts stored S3 credentials.            |
| `NEXT_PUBLIC_SITE_URL`   |    ✅    | `https://web.localhost`   | `https://s3-viewer.com`     | The web app's origin: CORS, the `Origin` check, trusted origins and email links.    |
| `NEXT_PUBLIC_API_URL`    |    ✅    | `https://api.localhost`   | `https://api.s3-viewer.com` | This API's own origin: Better Auth base URL, OAuth callbacks, `Secure` cookies.     |
| `RESEND_KEY`             |          | unset                     | `re_…`                      | Resend API key. Unset ⇒ emails are printed to the API log (never in production).    |
| `EMAIL_FROM`             |          | unset                     | `S3 Viewer <info@may.inc>`  | Sender for auth and invite email.                                                   |
| `GITHUB_CLIENT_ID`       |          | unset                     | GitHub OAuth app id         | Set together with the secret, or leave both unset.                                  |
| `GITHUB_CLIENT_SECRET`   |          | unset                     | GitHub OAuth app secret     | Set together with the id, or leave both unset.                                      |
| `PORT`                   |          | `5001`                    | `5001`                      | Port the API listens on.                                                            |
| `TRUST_PROXY`            |          | `loopback`                | `1`                         | Express `trust proxy`; behind a load balancer use the hop count.                    |
| `MAX_UPLOAD_BYTES`       |          | unset                     | unset                       | Largest upload body in bytes (checked against `Content-Length`). Unset ⇒ unlimited. |
| `LOG_LEVEL`              |          | `debug`                   | `warn`                      | `debug`, `info`, `warn` or `error`.                                                 |

`apps/web/.env`:

| Variable                            | Required | Local value                 | Production value                    | What it does                                                               |
| ----------------------------------- | :------: | --------------------------- | ----------------------------------- | -------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`              |    ✅    | `https://web.localhost`     | `https://s3-viewer.com`             | This app's own origin: auth redirects, canonical URLs and the sitemap.     |
| `NEXT_PUBLIC_API_URL`               |    ✅    | `https://api.localhost`     | `https://api.s3-viewer.com`         | Where every request goes.                                                  |
| `NEXT_PUBLIC_ENCRYPTION_PUBLIC_KEY` |    ✅    | `public_key.pem`            | `public_key.pem`                    | Public half of the RSA pair; encrypts S3 credentials in the browser.       |
| `NEXT_PUBLIC_GITHUB_LOGIN_ENABLED`  |          | `false`                     | `true`                              | Exactly `true` shows the GitHub button.                                    |
| `LANDING_ORIGIN`                    |          | `https://landing.localhost` | `https://<your-landing>.vercel.app` | Hidden landing deployment to proxy. Unset ⇒ `/` redirects to `/dashboard`. |

`apps/landing/.env`:

| Variable                   | Required | Local value             | Production value                    | What it does                                                                            |
| -------------------------- | :------: | ----------------------- | ----------------------------------- | --------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`     |    ✅    | `https://web.localhost` | `https://s3-viewer.com`             | The public origin this site is proxied under: canonical, OG and absolute links.         |
| `NEXT_PUBLIC_ASSET_PREFIX` |  build   | leave empty             | `https://<your-landing>.vercel.app` | This deployment's own origin, so `/_next/*` still resolves here when pages are proxied. |

Every `NEXT_PUBLIC_*` value is inlined at build time, so it has to be present when you run `pnpm build`, not only at runtime.

GitHub login is optional. To enable it, register an OAuth app at https://github.com/settings/developers with this **Authorization callback URL**:

```
https://api.s3-viewer.com/auth/callback/github
```

(locally `https://api.localhost/auth/callback/github`), then set `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` in `apps/api/.env` and `NEXT_PUBLIC_GITHUB_LOGIN_ENABLED=true` in `apps/web/.env`.

### 5. Database Setup

Apply the committed migrations to your database:

```bash
pnpm --filter @s3-viewer/db db:deploy
```

`db:deploy` runs `prisma migrate deploy` — it only applies migrations that already exist and never drops data. Only use `pnpm --filter @s3-viewer/db db:migrate` (`prisma migrate dev`) if you are **changing the Prisma schema**; it can reset your local database.

The Prisma client is generated for you: `pnpm dev` and `pnpm build` both run `db:generate` first via Turborepo. To do it by hand:

```bash
pnpm --filter @s3-viewer/db db:generate
```

### 6. Development

```bash
pnpm dev
```

## 🔑 Auth

Sign-in is handled by [Better Auth](https://better-auth.com):

- **Email OTP** — a one-time code sent to the address you enter.
- **Magic link** — a single-use sign-in link sent by email.
- **GitHub OAuth** — optional; the button is hidden when `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` are unset.

Sessions are cookie-based. The web app and the API are different hostnames on the same site, so the cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` whenever `NEXT_PUBLIC_API_URL` is `https://` — which is why both origins need HTTPS. Locally the Portless certificates cover that. Sessions last 30 days and refresh at most once a day; IP address tracking is off.

Every non-`GET` request is additionally checked for an `Origin` matching `NEXT_PUBLIC_SITE_URL` (or a same-site `Sec-Fetch-Site`), so a `SameSite=Lax` cookie is not enough on its own to drive a state change from another site.

## 📬 Email

Transactional email (OTP codes, magic links, server invitations) goes through [Resend](https://resend.com). Set `RESEND_KEY` in `apps/api/.env`.

If `RESEND_KEY` is unset, no mail is sent — messages are logged to the API console instead, which is enough to copy an OTP code or an invite link during local development.

## 👥 Permissions

Each server has an owner plus members, and every member holds one **server-level role**:

| Capability                          | Owner | Admin | Editor | Viewer |
| ----------------------------------- | :---: | :---: | :----: | :----: |
| List buckets                        |  ✅   |  ✅   |   ✅   |   ✅   |
| List / download objects             |  ✅   |  ✅   |   ✅   |   ✅   |
| Upload objects                      |  ✅   |  ✅   |   ✅   |   ❌   |
| Delete objects                      |  ✅   |  ✅   |   ✅   |   ❌   |
| Create buckets                      |  ✅   |  ✅   |   ✅   |   ❌   |
| Remove buckets from the server      |  ✅   |  ✅   |   ❌   |   ❌   |
| Rename the server                   |  ✅   |  ✅   |   ❌   |   ❌   |
| Invite / manage viewers and editors |  ✅   |  ✅   |   ❌   |   ❌   |
| Invite / manage admins              |  ✅   |  ❌   |   ❌   |   ❌   |
| Delete the server                   |  ✅   |  ❌   |   ❌   |   ❌   |

"Remove buckets from the server" is the **Remove bucket** action in the UI. It drops the bucket from this server's list and deletes the per-bucket grants that pointed at it; **nothing is deleted in S3**. There is no delete-a-bucket-at-the-provider action anywhere in the app.

### Bucket-level grants

The server-level role is a ceiling, not a blanket grant. Only the owner sees every bucket on a server. A non-owner sees **only the buckets explicitly granted to them**, and each grant carries its own role — so the same person can be an Editor on `uploads` and a Viewer on `backups` on the same server. A member with no bucket grants sees an empty bucket list.

Invitations carry the same shape: you pick a server role plus the buckets (and per-bucket roles) the invitee gets when they accept.

## 📦 Deploying

Three deployments, two public hosts:

- **Web** (`apps/web`) on `https://s3-viewer.com` with `NEXT_PUBLIC_SITE_URL=https://s3-viewer.com`, `NEXT_PUBLIC_API_URL=https://api.s3-viewer.com`, `NEXT_PUBLIC_ENCRYPTION_PUBLIC_KEY` and `LANDING_ORIGIN=<the landing's origin>`.
- **API** (`apps/api`) on `https://api.s3-viewer.com` with the same two URLs plus `DATABASE_URL`, `BETTER_AUTH_SECRET`, `ENCRYPTION_PRIVATE_KEY` and `RESEND_KEY`.
- **Landing** (`apps/landing`) as its own Vercel project on a hidden origin, with `NEXT_PUBLIC_SITE_URL=https://s3-viewer.com` and `NEXT_PUBLIC_ASSET_PREFIX=<its own origin>`, e.g. `https://s3-viewer-lp.vercel.app`. The web app proxies `/`, `/how-to`, `/use-cases`, `/legal`, `/about`, `/brand-kit` and `/landing/*` from it; its `robots.txt` disallows everything and every canonical points at `s3-viewer.com`.

Then:

1. Build everything:

   ```bash
   pnpm install --frozen-lockfile
   pnpm build
   ```

2. Set `NODE_ENV=production` and the variables above.

3. Apply migrations before starting the new version:

   ```bash
   pnpm --filter @s3-viewer/db db:deploy
   ```

4. Start the processes:

   ```bash
   pnpm --filter api start               # API (honours PORT, default 5001)
   pnpm --filter web start               # Next.js web app (next start)
   pnpm --filter landing start           # landing site (next start)
   ```

   `pnpm build` bundles the API to `apps/api/dist/server.js` with tsup (ESM,
   node20, workspace packages inlined). `pnpm --filter api start` regenerates
   the Prisma client and then runs `node dist/server.js`; run that file directly
   only if the client is already generated in the image.

5. Put a reverse proxy (nginx, Caddy, a cloud load balancer) with valid HTTPS certificates in front of both the API and the web app — session cookies will not work over plain HTTP.

6. Set `TRUST_PROXY` on the API so rate limiting and client IP handling behave behind that proxy. It defaults to `loopback`; behind a load balancer set it to the number of proxy hops in front of the API (e.g. `TRUST_PROXY=1`).

## 🔒 Data we store

Kept in your PostgreSQL database, and nowhere else:

- **Account**: user id, email address, name (it defaults to the local part of the email), and an optional avatar URL (from GitHub, if you sign in that way).
- **Sessions**: session tokens with their expiry and the browser's user-agent string, so you stay signed in. IP tracking is disabled (`advanced.ipAddress.disableIpTracking`), so the session's `ipAddress` column is never filled in.
- **Linked GitHub account**: only if you sign in with GitHub — the provider account id and the OAuth tokens it returns.
- **Servers**: the name you gave the server, the provider it points at, and the bucket names you allowed. Its endpoint, region, access key and secret live inside one **encrypted** blob: encrypted with your RSA public key in the browser, so the server stores only ciphertext and decrypts it in memory when it needs to talk to your provider.
- **Membership rows**: which users have access to which servers and buckets, and at what role, plus pending invitations.

No analytics, no third-party trackers, and no IP address logging. Object data itself never touches S3 Viewer's database: uploads are streamed through the API straight into your bucket without being stored, and downloads use presigned URLs straight from your provider.

### Security

Report vulnerabilities privately per [SECURITY.md](./SECURITY.md). What is in place today:

- **Client-side hybrid encryption for S3 credentials.** The browser generates an AES-256-GCM key, encrypts the credentials with it, and wraps that key with RSA-OAEP (SHA-256) using `NEXT_PUBLIC_ENCRYPTION_PUBLIC_KEY`. Only the API holds the private half. Credentials never come back to the browser and never appear in an API response.
- **Cross-site request protection.** `SameSite=Lax`, `HttpOnly` session cookies, plus an `Origin` / `Sec-Fetch-Site` check on every non-`GET` request, which rejects anything that did not come from `NEXT_PUBLIC_SITE_URL` with a 403.
- **Rate limits.** 300 requests/minute per IP before authentication, 600/minute per user id after it, and 5/minute per IP plus 5/10 minutes per email address on the sign-in flow. Set `TRUST_PROXY` correctly or the per-IP limits all key off your proxy.
- **SSRF guard on server endpoints.** An endpoint you add must be a public `https://` URL (`http://` is allowed outside production only); `localhost`, `*.localhost` and any hostname that resolves to a loopback, private, link-local or multicast address is rejected before a single request is signed.
- **No IP logging.** Better Auth's IP tracking is switched off and the API logger never writes a client address.
- **Authorization from validated input only.** Every route parses its input with a zod schema first, then checks the caller's server role and the effective bucket role; handlers never read `req.body` or `req.query` directly.

## 🧩 Adding UI Components

```bash
cd packages/ui
pnpm dlx shadcn@latest add [component]
```

## 🤝 Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, branch and commit conventions, and the checks to run before opening a PR (`pnpm lint && pnpm check-types && pnpm test`). Please also read our [Code of Conduct](./CODE_OF_CONDUCT.md), and report security issues privately per [SECURITY.md](./SECURITY.md).

## 📄 License

MIT © May Inc. See [LICENSE](./LICENSE).
