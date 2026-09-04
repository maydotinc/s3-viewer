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

There are four `.env` files — `apps/api/.env`, `apps/web/.env`, `apps/landing/.env` and `packages/db/.env` — each copied from the `.env.example` next to it:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/landing/.env.example apps/landing/.env
cp packages/db/.env.example packages/db/.env
```

Prisma runs with `packages/db` as its working directory, so it reads `packages/db/.env` rather than `apps/api/.env` — set `DATABASE_URL` in both (they're usually the same value). Skipping this one is the most common reason a fresh clone's first `db:deploy` fails with `P1012 Environment variable not found: DATABASE_URL`.

Users only ever see two hosts: the web app at `s3-viewer.com` and the API at `api.s3-viewer.com`.
The landing site is deployed separately on a hidden origin (a `*.vercel.app` URL) and the web app proxies the marketing routes from it, so it never appears in a URL.
Local dev mirrors this with the Portless hostnames: `web.localhost`, `api.localhost` and `landing.localhost`.

`apps/api/.env` (validated on startup by `apps/api/lib/env.ts`):

| Variable                 | Required | Local value               | Production value                        | What it does                                                                                                                                                                                                          |
| ------------------------ | :------: | ------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           |    ✅    | `postgresql://…`          | `postgresql://…`                        | PostgreSQL connection string for Prisma.                                                                                                                                                                              |
| `BETTER_AUTH_SECRET`     |    ✅    | `openssl rand -base64 32` | `openssl rand -base64 32`               | Signs sessions and tokens; at least 32 characters.                                                                                                                                                                    |
| `ENCRYPTION_PRIVATE_KEY` |    ✅    | `private_key.pem`         | `private_key.pem`                       | RSA private key (2048 bits or more) that decrypts stored S3 credentials.                                                                                                                                              |
| `NEXT_PUBLIC_SITE_URL`   |    ✅    | `https://web.localhost`   | `https://s3-viewer.com`                 | The web app's origin: CORS, the `Origin` check, trusted origins and email links.                                                                                                                                      |
| `NEXT_PUBLIC_API_URL`    |    ✅    | `https://api.localhost`   | `https://api.s3-viewer.com`             | This API's own origin: Better Auth base URL, OAuth callbacks, `Secure` cookies.                                                                                                                                       |
| `NODE_ENV`               |          | `development`             | `production`                            | Also gates whether a cleartext `http://` S3 endpoint is accepted (`development`/`test` only).                                                                                                                         |
| `EMAIL_TRANSPORT`        |          | unset                     | unset                                   | `resend` or `smtp`. Unset ⇒ `resend`. Choose `smtp` to send auth and invite email through your own server instead of a third party.                                                                                   |
| `SMTP_URL`               | if smtp  | unset                     | `smtp://user:pass@mail.example.com:587` | SMTP connection string (`smtp://` or `smtps://`). **Required in every environment when `EMAIL_TRANSPORT=smtp`**; ignored otherwise.                                                                                   |
| `RESEND_KEY`             |   prod   | unset                     | `re_…`                                  | Resend API key. **Required in production** while `EMAIL_LOGIN_ENABLED` is on, unless `EMAIL_TRANSPORT=smtp` — the API refuses to start without it there. Unset otherwise ⇒ emails are printed to the API log.         |
| `EMAIL_FROM`             |   prod   | unset                     | `S3 Viewer <hello@yourdomain.com>`      | Sender for auth and invite email. **Required in production** — there is no default sender, so a self-hosted deploy never sends mail claiming to be from May Inc. Unset in development ⇒ a placeholder sender.         |
| `SUPPORT_EMAIL`          |          | unset                     | `support@yourdomain.com`                | Contact shown to admins who hit the server or pending-invite cap, and in the account-deletion confirmation email. Unset ⇒ omitted from the message; the email points at GitHub issues instead.                        |
| `EMAIL_LOGIN_ENABLED`    |          | unset                     | unset                                   | Sign in with a one-time code / magic link; also powers email verification and password reset. On unless exactly `false`. Off ⇒ no mail transport needed, but addresses can never be verified, which invites require.  |
| `PASSWORD_LOGIN_ENABLED` |          | unset                     | unset                                   | Sign in with email and password. On unless exactly `false`. At least one method (this, email, or GitHub) must stay on.                                                                                                |
| `GITHUB_CLIENT_ID`       |          | unset                     | GitHub OAuth app id                     | Set together with the secret, or leave both unset.                                                                                                                                                                    |
| `GITHUB_CLIENT_SECRET`   |          | unset                     | GitHub OAuth app secret                 | Set together with the id, or leave both unset.                                                                                                                                                                        |
| `PORT`                   |          | `5001`                    | `5001`                                  | Port the API listens on.                                                                                                                                                                                              |
| `TRUST_PROXY`            |          | `loopback`                | `1`                                     | Express `trust proxy`; behind a load balancer use the hop count.                                                                                                                                                      |
| `MAX_UPLOAD_BYTES`       |          | `5368709120`              | `5368709120`                            | Largest upload body in bytes, enforced while streaming so a false `Content-Length` cannot bypass it. Unset ⇒ 5 GiB. Raise it for larger objects.                                                                      |
| `UPLOAD_PART_BYTES`      |          | `26214400`                | `26214400`                              | Multipart part size in bytes. Unset ⇒ 25 MiB. Min 5 MiB, max 5 GiB. A known `Content-Length` raises the part size when needed to stay under S3's 10,000-part cap, capped at 64 MiB so one upload cannot exhaust heap. |
| `LOG_LEVEL`              |          | `debug`                   | `warn`                                  | `debug`, `info`, `warn` or `error`. Unset ⇒ `warn` in production, `debug` otherwise.                                                                                                                                  |

`apps/web/.env`:

| Variable                             | Required | Local value                 | Production value                    | What it does                                                               |
| ------------------------------------ | :------: | --------------------------- | ----------------------------------- | -------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`               |    ✅    | `https://web.localhost`     | `https://s3-viewer.com`             | This app's own origin: auth redirects, canonical URLs and the sitemap.     |
| `NEXT_PUBLIC_API_URL`                |    ✅    | `https://api.localhost`     | `https://api.s3-viewer.com`         | Where every request goes.                                                  |
| `NEXT_PUBLIC_ENCRYPTION_PUBLIC_KEY`  |    ✅    | `public_key.pem`            | `public_key.pem`                    | Public half of the RSA pair; encrypts S3 credentials in the browser.       |
| `NEXT_PUBLIC_EMAIL_LOGIN_ENABLED`    |          | unset                       | unset                               | Mirrors `EMAIL_LOGIN_ENABLED`: on unless exactly `false`.                  |
| `NEXT_PUBLIC_PASSWORD_LOGIN_ENABLED` |          | unset                       | unset                               | Mirrors `PASSWORD_LOGIN_ENABLED`: on unless exactly `false`.               |
| `NEXT_PUBLIC_GITHUB_LOGIN_ENABLED`   |          | `false`                     | `true`                              | Exactly `true` shows the GitHub button.                                    |
| `LANDING_ORIGIN`                     |          | `https://landing.localhost` | `https://<your-landing>.vercel.app` | Hidden landing deployment to proxy. Unset ⇒ `/` redirects to `/dashboard`. |

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

Two migrations need an operator's attention rather than a blind `db:deploy`:

- **`20260903020000_lowercase_existing_emails`** aborts with a `RAISE EXCEPTION` if two accounts collide once their addresses are lowercased (`ada@x.com` and `Ada@x.com`). It names the offending addresses; merge or delete one of each pair, then re-run. It is deliberately fail-loud rather than picking a winner for you.
- **`20260903000000_account_provider_account_unique`** copies duplicate `account` rows into a permanent `account_dedupe_backup` table before removing them. **That table is never cleaned up, and it has `accessToken`, `refreshToken`, `idToken` and `password` columns**, so on a database that has run this migration it can hold OAuth tokens in plaintext indefinitely. Once you have confirmed nobody lost a sign-in link, drop it:

   ```sql
   -- inspect first; it is empty on a database that never had duplicates
   SELECT count(*) FROM "account_dedupe_backup";
   DROP TABLE IF EXISTS "account_dedupe_backup";
   ```

   It is intentionally not dropped by a migration, because only you can tell whether its contents are still needed.

The Prisma client is generated for you: `pnpm dev` and `pnpm build` both run `db:generate` first via Turborepo. To do it by hand:

```bash
pnpm --filter @s3-viewer/db db:generate
```

### 6. Development

```bash
pnpm dev
```

## 🔑 Auth

Sign-in is handled by [Better Auth](https://better-auth.com). Every method is a flag, and all of them are on by default:

- **Email and password** — the simplest way to self-host: nothing to set up. `PASSWORD_LOGIN_ENABLED` / `NEXT_PUBLIC_PASSWORD_LOGIN_ENABLED`.
- **Email OTP and magic link** — one email carrying a one-time code and a single-use sign-in link. `EMAIL_LOGIN_ENABLED` / `NEXT_PUBLIC_EMAIL_LOGIN_ENABLED`. Needs a mail transport in production.
- **GitHub OAuth** — on once `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` are set and `NEXT_PUBLIC_GITHUB_LOGIN_ENABLED=true`.

Set a flag to exactly `false` to turn a method off; at least one must stay on or the API refuses to start. The login page shows whatever is on: with both email methods it offers a password form plus "Email me a code instead", and the code flow still creates accounts the way it always did.

Passwords are 8–128 characters, hashed by Better Auth, and stored in the `account` row for the `credential` provider. A password sign-up starts signed in and is asked for a verification code right away (skippable); an unverified address can still use the app but cannot send or accept invites, since invites are matched by address. **Forgot password** sends a code by email and then takes a new password — this is also how an account that signed up by code or GitHub adds its first one — and **Settings → Profile** has a Password card to set or change it (changing it signs out other devices). Both need `EMAIL_LOGIN_ENABLED`, because that is what sends codes; a deployment with no mail transport is password-only and its addresses can never be verified.

Password sign-in is limited to 10 attempts per address per 10 minutes on top of the per-IP limit, and outbound verification or reset codes to 5 per address per 10 minutes.

Sessions are cookie-based. The web app and the API are different hostnames on the same site, so the cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` whenever `NEXT_PUBLIC_API_URL` is `https://` — which is why both origins need HTTPS. Locally the Portless certificates cover that. Sessions last 30 days and refresh at most once a day; IP address tracking is off.

Every non-`GET` request is additionally checked for an `Origin` matching `NEXT_PUBLIC_SITE_URL` (or a same-site `Sec-Fetch-Site`), so a `SameSite=Lax` cookie is not enough on its own to drive a state change from another site.

## 📬 Email

Transactional email (OTP codes, magic links, verification and reset codes, server invitations) goes through [Resend](https://resend.com) by default. Set `RESEND_KEY` and `EMAIL_FROM` in `apps/api/.env` — both are required in production while email login is on; the API refuses to start without `RESEND_KEY`, and sending mail throws without `EMAIL_FROM` (there is no default sender, so a self-hosted deploy never sends mail claiming to be from May Inc.).

To depend on no third party for mail, set `EMAIL_TRANSPORT=smtp` and point `SMTP_URL` at your own server (`smtp://user:pass@mail.example.com:587`, or `smtps://…` for implicit TLS). `SMTP_URL` is then required in every environment — selecting a transport with nowhere to connect is a misconfiguration, so it fails at boot rather than at first sign-in — and `RESEND_KEY` is not needed at all. `EMAIL_FROM` still applies.

If neither is configured, no mail is sent — messages are logged to the API console instead, which is enough to copy an OTP code or an invite link during local development. In production that is only allowed with `EMAIL_LOGIN_ENABLED=false` (password and/or GitHub sign-in only), where the log would carry invite and account notices rather than sign-in codes.

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
- **API** (`apps/api`) on `https://api.s3-viewer.com` with the same two URLs plus `DATABASE_URL`, `BETTER_AUTH_SECRET`, `ENCRYPTION_PRIVATE_KEY`, `RESEND_KEY` and `EMAIL_FROM` (the last two only while email login is on).
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

6. Set `TRUST_PROXY` on the API so rate limiting and client IP handling behave behind that proxy. It defaults to `loopback`, which is safe with no reverse proxy at all.

> **⚠️ `TRUST_PROXY` warning.** All per-IP rate limits (see [Running in production](#-running-in-production)) key off the IP Express derives from this setting. Set it to the exact number of reverse proxies in front of the API — e.g. `TRUST_PROXY=1` for a single load balancer or nginx/Caddy instance that overwrites `X-Forwarded-For` — and confirm that proxy strips or replaces any client-supplied `X-Forwarded-For` rather than appending to it. If you instead set `TRUST_PROXY=true` (or too high a hop count) behind a proxy that does not strip that header, any client can forge its own `X-Forwarded-For` and get a fresh rate-limit bucket on every request, making every per-IP limit trivially bypassable. When unsure, leave it at `loopback` and put the API behind a proxy you configure yourself.

## 📈 Running in production

- **Rate limiting is in-memory and per-instance.** `express-rate-limit` (`apps/api/lib/middleware/rate-limit.ts`) uses the default in-memory store — there is no shared Redis/store backing it. Every limit documented under [Security](#security) is enforced per API process: run N instances behind a load balancer and the effective limit is N× the documented number, and every counter resets whenever a process restarts or redeploys. Treat the numbers as a soft, best-effort ceiling, not a hard guarantee, until you put a shared store in front of it.
- **A misconfigured `RESEND_KEY` fails silently to the client.** `POST /auth-flow/start` always returns `204` — including when sending the email throws — so that a broken mail provider can't be used to tell attackers which email addresses have accounts (an email-enumeration oracle). If sign-in email is broken in production, users see no error at all; the only signal is the error-level log line ("Auth flow email failed") the API writes on that path. Alert on that log line, not on client-visible errors.
- **SSRF guard checks DNS on every connection, not just once.** Server endpoints are checked up front when a server is connected, its credentials change, or its cached S3 client is (re)built: the hostname must be public and every DNS answer public at that moment (see [Security](#security)). That up-front check alone would leave a DNS-rebinding gap — a hostname whose DNS later repoints to a private address — but the same public/private rules also run as a custom `dns.lookup` on the shared http/https agents the S3 clients connect through (`apps/api/lib/s3/client-cache.ts`), so a rebound hostname is rejected when a socket actually connects, not just at the original check. Self-hosters should still restrict egress at the network layer (run the API in a network segment / security group that cannot reach internal services) as defense in depth — the app-level check protects against DNS-based SSRF, not against every route a misconfigured or malicious endpoint could reach.

## 🔒 Data we store

Kept in your PostgreSQL database, and nowhere else:

- **Account**: user id, email address, and name (it defaults to the local part of the email). There are no profile pictures: your avatar is your initials on a colour generated from your name, so nothing is uploaded and nothing is stored — not even the avatar URL GitHub offers when you sign in that way.
- **Sessions**: session tokens with their expiry only — validity depends solely on the token and its expiry, not on IP or device. Neither IP address nor user agent is retained: IP tracking is disabled (`advanced.ipAddress.disableIpTracking`), so the session's `ipAddress` column (present because it's part of Better Auth's core schema) is never filled in; `userAgent` has no column at all — it was dropped from the schema since nothing ever read it.
- **Password**: only if you set one — a Better Auth hash in the `account` row for the `credential` provider, never the password itself.
- **Linked GitHub account**: only if you sign in with GitHub — the provider account id. The OAuth access, refresh and id tokens GitHub returns are dropped before the row is written: nothing in the product ever reads them, so they are not worth storing next to envelope-encrypted credentials.
- **Servers**: the name you gave the server, the provider it points at, and the bucket names you allowed. Its endpoint, region, access key and secret live inside one **encrypted** blob: encrypted with your RSA public key in the browser, so the server stores only ciphertext and decrypts it in memory when it needs to talk to your provider.
- **Membership rows**: which users have access to which servers and buckets, and at what role, plus pending invitations.
- **Audit log**: one row per administrative or destructive action (server and credential changes, membership and invite changes, bucket and object deletion or rename) with the action, the acting user id, the server id, and a short target such as a bucket name, object key or invited email address. Reads, downloads and uploads are deliberately not recorded — the volume would bury the signal.

The audit log is **never pruned automatically and has no foreign keys**, so its rows deliberately outlive the user or server they refer to — that is what makes it an audit trail rather than a join table. The table therefore grows without bound; set a retention window that suits your jurisdiction, for example a nightly `DELETE FROM "audit_log" WHERE "createdAt" < now() - interval '1 year';`.

### Deleting your account

Settings → Profile → **Delete account** removes everything above that belongs to you: the account row (name and email), every session and linked sign-in, every server you own together with its encrypted credentials, its members' access and its pending invitations, your own memberships and bucket grants, the invitations you sent, and the invitations addressed to your email. Any cached, decrypted credentials for the servers you owned are dropped from the API's memory at the same time. Audit entries for actions you took are kept, because they are also part of other members' history: the acting user id stays (it no longer resolves to anyone) and every audit `target` that held your email address is replaced with the literal `[deleted user]`, so the log retains no personal data about you. Nothing in your buckets is read or changed. Deleting needs a session younger than 24 hours — an older one is sent back to sign in first — and the dialog lists exactly which servers, memberships and invitations will go before you type your email to confirm. A confirmation email follows once the deletion has completed; it names `SUPPORT_EMAIL` as the contact when that variable is set, and the GitHub issues page otherwise.

No analytics, no third-party trackers, and no IP address logging. Object data itself never touches S3 Viewer's database: uploads are streamed through the API straight into your bucket without being stored, and downloads use presigned URLs straight from your provider.

### Security

Report vulnerabilities privately per [SECURITY.md](./SECURITY.md). What is in place today:

- **Client-side hybrid encryption for S3 credentials.** The browser generates an AES-256-GCM key, encrypts the credentials with it, and wraps that key with RSA-OAEP (SHA-256) using `NEXT_PUBLIC_ENCRYPTION_PUBLIC_KEY`. Only the API holds the private half. Credentials never come back to the browser and never appear in an API response.
- **Cross-site request protection.** `SameSite=Lax`, `HttpOnly` session cookies, plus an `Origin` / `Sec-Fetch-Site` check on every non-`GET` request, which rejects anything that did not come from `NEXT_PUBLIC_SITE_URL` with a 403.
- **Rate limits.** 1200 requests/minute per IP before authentication (6000/minute per IP on the bucket routes instead, also before authentication), 1800/minute per user id, 5/minute per IP plus 5/10 minutes per email address on the sign-in email flow, 10/10 minutes per email address on password sign-in, and 5/10 minutes per address on verification and reset codes. Set `TRUST_PROXY` correctly or the per-IP limits all key off your proxy.
- **SSRF guard on server endpoints.** An endpoint you add must be a public `https://` URL (`http://` is allowed outside production only); `localhost`, `*.localhost` and any hostname that resolves to a loopback, private, link-local or multicast address is rejected before a single request is signed.
- **No IP logging.** Better Auth's IP tracking is switched off and the API logger never writes a client address.
- **Authorization from validated input only.** Every route parses its input with a zod schema first, then checks the caller's server role and the effective bucket role; handlers never read `req.body` or `req.query` directly.

## 🧩 Adding UI Components

```bash
cd packages/ui
pnpm dlx shadcn@latest add [component]
```

## 🖼️ Favicons

Every favicon, touch icon, manifest icon and `site.webmanifest` is generated from the brand kit's app icon (`apps/landing/public/icons/viewerblue.svg`) into **both** `apps/web/public` and `apps/landing/public`, because landing pages are proxied under the web app's domain and their root-relative icon URLs resolve against whichever app serves them. The shared `<link>` tags live in `packages/ui/src/components/favicon-links.tsx`. Never hand-edit the outputs — change the SVG and run:

```bash
pnpm favicons
```

## 🤝 Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, branch and commit conventions, and the checks to run before opening a PR (`pnpm lint && pnpm check-types && pnpm test`). Changes to API routes, rate limits, error codes or permissions should also match [CONTRACTS.md](./CONTRACTS.md), the engineering agreement between the API, the web app, the landing site and the shared packages. Please also read our [Code of Conduct](./CODE_OF_CONDUCT.md), and report security issues privately per [SECURITY.md](./SECURITY.md).

## 📄 License

MIT © May Inc. See [LICENSE](./LICENSE).
