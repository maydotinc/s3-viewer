# S3 Viewer 🪣

A web-based S3-compatible object storage browser that lets you manage multiple S3 servers through a modern interface, with the familiarity of a traditional file explorer.

<img src="./apps/landing/public/landing/bucketview.png" alt="S3 Viewer showing a bucket listing with folders, objects and the row actions menu" width="100%">

## 📝 Features

- Connect to multiple S3-compatible providers (AWS S3, Cloudflare R2, MinIO, etc.)
- Credentials encrypted in the browser before they ever reach the server
- Server sharing and collaboration, with per-bucket access grants
- Multi-user support with role-based permissions
- Browse and download across providers; conditional uploads and guarded AWS rename/delete ([capabilities and restrictions](./PROVIDER-COMPATIBILITY.md))
- Progress tracking, multipart uploads, and per-object failure reporting

## 🧬 Architecture

- **Frontend**: Next.js with shadcn/ui components (`apps/web`)
- **Landing**: Next.js marketing site (`apps/landing`), optional
- **Backend**: Express.js API (`apps/api`)
- **Database**: PostgreSQL with Prisma ORM (`packages/db`)
- **Authentication**: Better Auth (`packages/auth`)
- **Monorepo**: Turborepo with pnpm workspaces
- **Object data path**: uploads stream through the API so buckets need no CORS configuration; downloads use short-lived presigned URLs.
- **Runtime config**: one Docker image serves any install. The web app reads its own origin and the API's origin at request time (never baked in at build time), and fetches `GET /config` on the API for the encryption public key and whether GitHub login and email are turned on. Nothing instance-specific is inlined into the browser bundle.

## 🚀 Quick Start

```bash
git clone https://github.com/maydotinc/s3-viewer
cd s3-viewer
pnpm install
pnpm dev
```

No `pnpm` yet? `corepack enable` turns it on for Node 24 and older; Node 25 and newer ship without Corepack, so there it's `npm i -g pnpm`.

That's it. If `apps/api/.env` doesn't exist yet, `pnpm dev` runs a short interactive setup wizard first (Postgres, a local mail inbox and a demo bucket are all optional and run in Docker for you), then starts the web app on `:3000`, the API on `:5001`, and the landing site on `:3001` if you chose it. Run the wizard on its own any time with `pnpm run setup`.

Prefer Docker for a self-hosted instance instead of a dev setup?

```bash
docker compose up -d
```

then open `http://localhost:3000` — a working install with zero configuration. Add `--build` to build the images from this checkout instead of pulling from `ghcr.io/maydotinc`. (The optional landing site has no published image — it inlines your site URL when it is compiled, so the `landing` profile always builds it from the checkout.) Both containers report their own health (`/health` on the API, `/api/health` on the web app), so `docker compose ps` tells you when the stack is actually ready.

The default install sends no email. Create your account, then use the
[operator verification command](./SELF-HOSTING.md#verify-an-account-without-email)
and sign in again before connecting your first server.

Putting it on a real domain behind the bundled Caddy means one longer command, always with both files:

```bash
docker compose -f docker-compose.yml -f docker-compose.proxy.yml --profile proxy up -d
```

The overlay is what tells the API to trust Caddy for client IPs; without it every per-IP rate limit sees the proxy's address instead and shares a single bucket. Set `SITE_HOSTNAME`, `API_HOSTNAME` and `ACME_EMAIL` in the root `.env` first.

Everything else, including every environment variable, per-service setup (email, GitHub OAuth, the demo bucket, the landing site, a Caddy reverse proxy), production notes and the capability matrix, is in **[SELF-HOSTING.md](./SELF-HOSTING.md)**.

Before opening a PR run `pnpm lint && pnpm check-types && pnpm test`, and `pnpm format` to apply Prettier (`pnpm format:check` runs in CI). Changes to API routes, rate limits, error codes or permissions must match [CONTRACTS.md](./CONTRACTS.md), the engineering agreement between the API, the web app, the landing site and the shared packages.

## ☁️ Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/maydotinc/s3-viewer)

| Platform                | How                                                                                                  | Notes                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Render**              | The button above, or **New → Blueprint** on [`render.yaml`](./render.yaml)                           | Managed Postgres and a 1 GB disk for the API's keys. Paste both public URLs when prompted. [Runbook](./SELF-HOSTING.md#render)          |
| **Fly.io**              | `fly deploy -c deploy/fly/<app>.toml --dockerfile apps/<app>/Dockerfile`                             | Two apps, Managed Postgres, a volume on `/data`; add `--ha=false` on the API. [Runbook](./SELF-HOSTING.md#flyio)                        |
| **Railway**             | Two services from this repo, configured in the dashboard                                             | Dockerfile builder, a volume on the API at `/data`, and domain vars that need `https://` prefixed. [Runbook](./SELF-HOSTING.md#railway) |
| **Coolify / Portainer** | Point either at this repo's [`docker-compose.yml`](./docker-compose.yml)                             | Their own proxy terminates TLS, so set `TRUST_PROXY=1` and skip the `proxy` profile. [Runbook](./SELF-HOSTING.md#coolify--portainer)    |
| **Docker Compose**      | `docker compose -f docker-compose.yml -f docker-compose.proxy.yml --profile proxy up -d` on your box | Bundled Caddy fetches your certificates. [Runbook](./SELF-HOSTING.md#reverse-proxy--caddy)                                              |

All five want the same handful of values — `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_API_URL` as full origins, `DATABASE_URL`, and a persistent `/data` on the API — documented once in the [env reference](./SELF-HOSTING.md#7-full-env-reference).

## 🔑 Auth

Sign-in is handled by [Better Auth](https://better-auth.com):

- **Email and password**: always on, and the simplest way to self-host: nothing to set up.
- **GitHub OAuth**: optional; the only switch is setting `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` together in `apps/api/.env`. The web app shows the GitHub button once the API reports `githubLoginEnabled` from `GET /config`; there is nothing to set in `apps/web/.env`.

Sign-in and sign-up are one flow. `/login` and `/signup` differ only in their words: a password that matches signs you in, and an address with no account is created with that password. (Sign-up already reveals whether an address has an account, so this leaks nothing new.) Passwords are 8–128 characters, hashed by Better Auth, and stored in the `account` row for the `credential` provider.

Email is used for exactly two links, both valid for one hour:

- **Verify your email.** Sent on sign-up, and again from Settings → Profile or from the callouts that need it. A new account is signed in straight away, but two things wait for the link: **connecting a server** (its credentials belong to whoever can reset the account's password, which is whoever owns the address, so the address is proven first) and **invites** (matched by address, so sending and accepting both refuse an unverified one). The link lands on Settings → Profile.
- **Reset your password.** "Forgot password?" sends a link to `/reset-password`; choosing a new password signs out every other device. This is also how a GitHub-only account adds a password. Settings → Profile has a Password card to change one, or to set a first one, which (like deleting the account) needs a session younger than 24 hours so a stolen cookie is not enough to claim the account.

Whether those links can be sent depends on `EMAIL_TRANSPORT` (see Email below). With no transport configured, sign-in still works; an operator can [verify an account from the API console](./SELF-HOSTING.md#verify-an-account-without-email) so it can connect a server. Emailed verification, password recovery and invites remain unavailable; the UI explains the operator workflow wherever verification is needed. Treat a transport as required for anything beyond a single-user box.

Password sign-in is limited to 10 attempts per address per 10 minutes on top of the per-IP limit, account creation to 10 per IP per hour, and outbound verification or reset links to 5 per address per 10 minutes.

Sessions are cookie-based, `HttpOnly`, `SameSite=Lax`, and `Secure` whenever `NEXT_PUBLIC_API_URL` is `https://`. Sessions last 30 days and refresh at most once a day; IP address tracking is off. Session validity is checked against the database, including when managing login methods; signed cookie caches cannot keep a revoked session active.

Every non-`GET` request is additionally checked for an `Origin` matching `NEXT_PUBLIC_SITE_URL` (or a same-site `Sec-Fetch-Site`), so a `SameSite=Lax` cookie is not enough on its own to drive a state change from another site.

## 📬 Email

Transactional email (verification links, password-reset links, server invitations, account-deletion notices) has three modes, chosen by `EMAIL_TRANSPORT` in `apps/api/.env`:

- **`none`**: no mail is sent, and this is a fully supported way to run S3 Viewer. Sign-in still works; operators can verify accounts using the console command above. Password reset, emailed verification and invites are unavailable, and the UI says so wherever it would otherwise offer them. In development the full message is still printed to the API log so you can copy a link; in production it is dropped entirely.
- **`resend`**: sends through [Resend](https://resend.com). Set `RESEND_KEY` and `EMAIL_FROM`.
- **`smtp`**: depends on no third party. Set `SMTP_URL` (`smtp://user:pass@mail.example.com:587`, or `smtps://…` for implicit TLS) and `EMAIL_FROM`.

Leaving `EMAIL_TRANSPORT` unset infers a mode: `resend` if `RESEND_KEY` is set, else `smtp` if `SMTP_URL` is set, else `none`. Naming a transport explicitly without its credential is a boot-time error rather than a silent no-op. `EMAIL_FROM` is required in production for `resend` and `smtp`, since there is no default sender and a self-hosted deploy must never send mail claiming to be from May Inc., and is not needed at all with `none`.

The API logs exactly one line at boot naming the resolved mode. The web app learns whether email is on from `GET /config`'s `emailEnabled` field, never from its own environment.

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

The server-level role is a ceiling, not a blanket grant. Only the owner sees every bucket on a server. A non-owner sees **only the buckets explicitly granted to them**, and each grant carries its own role, so the same person can be an Editor on `uploads` and a Viewer on `backups` on the same server. A member with no bucket grants sees an empty bucket list.

Invitations carry the same shape: you pick a server role plus the buckets (and per-bucket roles) the invitee gets when they accept.

## 📦 Running in production

See [SELF-HOSTING.md](./SELF-HOSTING.md) for the full picture: Docker deployment, every environment variable, the reverse-proxy setup and production notes. A short summary of what to keep in mind once you're live:

- **Rate limiting is in-memory and per-instance.** `express-rate-limit` (`apps/api/lib/middleware/rate-limit.ts`) uses the default in-memory store; there is no shared Redis/store backing it. Every limit documented under [Security](#security) is enforced per API process: run N instances behind a load balancer and the effective limit is N× the documented number, and every counter resets whenever a process restarts or redeploys. Treat the numbers as a soft, best-effort ceiling, not a hard guarantee, until you put a shared store in front of it.
- **Credential updates are checked across API workers.** Before reusing an S3 client, every worker checks its encrypted credential identity and provider against PostgreSQL. A failed database check refuses the operation. An operation that already obtained its client can finish during a later credential change.
- **A broken mail provider fails silently to the client.** Verification and reset links are sent after the request has already succeeded, and the response never reveals whether an address has an account, so a mail failure surfaces only as an error-level log line (`[auth] verify email failed` / `[auth] reset email failed`). Alert on those lines, not on client-visible errors.
- **SSRF guard checks DNS on every connection, not just once.** Server endpoints are checked up front when a server is connected, its credentials change, or its cached S3 client is (re)built: the hostname must be public and every DNS answer public at that moment (see [Security](#security)). That up-front check alone would leave a DNS-rebinding gap, namely a hostname whose DNS later repoints to a private address, but the same public/private rules also run as a custom `dns.lookup` on the shared http/https agents the S3 clients connect through (`apps/api/lib/s3/client-cache.ts`), so a rebound hostname is rejected when a socket actually connects, not just at the original check. Self-hosters should still restrict egress at the network layer (run the API in a network segment / security group that cannot reach internal services) as defense in depth; the app-level check protects against DNS-based SSRF, not against every route a misconfigured or malicious endpoint could reach.

## 🔒 Data we store

Kept in your PostgreSQL database, and nowhere else:

- **Account**: user id, email address, and name (it defaults to the local part of the email). There are no profile pictures: your avatar is your initials on a colour generated from your name, so nothing is uploaded and nothing is stored, not even the avatar URL GitHub offers when you sign in that way.
- **Sessions**: session tokens with their expiry only; validity depends solely on the token and its expiry, not on IP or device. Neither IP address nor user agent is retained: IP tracking is disabled (`advanced.ipAddress.disableIpTracking`), so the session's `ipAddress` column (present because it's part of Better Auth's core schema) is never filled in; `userAgent` has no column at all, since it was dropped from the schema after nothing ever read it.
- **Password**: only if you set one, a Better Auth hash in the `account` row for the `credential` provider, never the password itself.
- **Linked GitHub account**: only if you sign in with GitHub, the provider account id. The OAuth access, refresh and id tokens GitHub returns are dropped before the row is written: nothing in the product ever reads them, so they are not worth storing next to envelope-encrypted credentials.
- **Servers**: the name you gave the server, the provider it points at, and the bucket names you allowed. Its endpoint, region, access key and secret live inside one **encrypted** blob: encrypted with your RSA public key in the browser, so the server stores only ciphertext and decrypts it in memory when it needs to talk to your provider.
- **Membership rows**: which users have access to which servers and buckets, and at what role, plus pending invitations.
- **Audit log**: one row per administrative or destructive action (server and credential changes, membership and invite changes, bucket and object deletion or rename) with the action, the acting user id, the server id, and a short target such as a bucket name, object key or invited email address. Reads, downloads and uploads are deliberately not recorded, since the volume would bury the signal.

The audit log is **never pruned automatically and has no foreign keys**, so its rows deliberately outlive the user or server they refer to; that is what makes it an audit trail rather than a join table. The table therefore grows without bound; set a retention window that suits your jurisdiction, for example a nightly `DELETE FROM "audit_log" WHERE "createdAt" < now() - interval '1 year';`.

### Deleting your account

Settings → Profile → **Delete account** removes everything above that belongs to you: the account row (name and email), every session and linked sign-in, every server you own together with its encrypted credentials, its members' access and its pending invitations, your own memberships and bucket grants, the invitations you sent, and the invitations addressed to your email. Any cached, decrypted credentials for the servers you owned are dropped from the API's memory at the same time. Audit entries for actions you took are kept, because they are also part of other members' history: the acting user id stays (it no longer resolves to anyone) and every audit `target` that held your email address is replaced with the literal `[deleted user]`, so the log retains no personal data about you. Nothing in your buckets is read or changed. Deleting needs a session younger than 24 hours (an older one is sent back to sign in first), and the dialog lists exactly which servers, memberships and invitations will go before you type your email to confirm. A confirmation email follows once the deletion has completed; it names `SUPPORT_EMAIL` as the contact when that variable is set, and the GitHub issues page otherwise.

No analytics, no third-party trackers, and no IP address logging. Object data itself never touches S3 Viewer's database: uploads are streamed through the API straight into your bucket without being stored, and downloads use presigned URLs straight from your provider.

### Security

Report vulnerabilities privately per [SECURITY.md](./SECURITY.md). What is in place today:

- **Client-side hybrid encryption for S3 credentials.** The browser generates an AES-256-GCM key, encrypts the credentials with it, and wraps that key with RSA-OAEP (SHA-256) using the encryption public key served at `GET /config`. Only the API holds the private half. Credentials never come back to the browser and never appear in an API response.
- **Cross-site request protection.** `SameSite=Lax`, `HttpOnly` session cookies, plus an `Origin` / `Sec-Fetch-Site` check on every non-`GET` request, which rejects anything that did not come from `NEXT_PUBLIC_SITE_URL` with a 403.
- **Rate limits.** 1200 requests/minute per IP before authentication (6000/minute per IP on the bucket routes instead, also before authentication), 1800/minute per user id, 20/minute per IP on every non-GET auth route, 10/10 minutes per IP and email address on password sign-in (60/10 minutes per address as a backstop), 10 accounts created per IP per hour, and 5/10 minutes per address on verification and reset links. Set `TRUST_PROXY` correctly or the per-IP limits all key off your proxy.
- **Bounded request bodies and uploads.** Auth bodies are capped at 64 KiB, including chunked requests; compressed auth bodies are rejected. Uploads default to 6 active per API process, 3 per user, a 256 MiB buffer reservation budget, and a two-minute inactivity timeout. See the self-hosting env reference to tune these independently of the maximum object size.
- **Conditional deletion without replay.** AWS object deletion requires a valid reviewed ETag and uses one SDK attempt. R2 and compatible endpoints refuse deletion because conditional-delete safety is not verified. Uncertain results require refresh and review; unversioned AWS deletes can still be permanent.
- **Reviewed rename.** AWS rename requires the ETag captured before confirmation, preserves readable metadata/ACLs/tags, and rechecks both names before conditional source deletion. Unsupported providers and unreadable encryption settings stop before mutation. Copy and delete are not atomic across keys, so external concurrent writers remain a limitation.
- **Account-bound uploads.** Queued files and results are erased on sign-out, account changes, or confirmed session expiry. Mutation requests identify their initiating account, which the API verifies before writing. Already completed uploads are not rolled back.
- **Immediate permission checks.** Revoked sessions cannot manage login methods through a cached cookie; bucket removal rechecks the actor after acquiring its transaction lock.
- **Upload overwrite protection.** New uploads require absent keys and replacements require reviewed ETags. Replacements preserve readable permissions, metadata and storage settings, checking again before publication; objects whose encryption/settings cannot be preserved are rejected. Conflicts never trigger an unconditional fallback. B2 uploads are blocked pending verified conditional-write support. See [provider compatibility](./PROVIDER-COMPATIBILITY.md) for exact capabilities and validation scope.
- **Bucket creation preserves existing access.** Existing bucket names are rejected for owners and members. Creation is not retried automatically, duplicate app requests are serialized, and the creator's permissions and credential target are checked again before new access is granted.
- **SSRF guard on server endpoints.** An endpoint you add must be a public `https://` URL (`http://` is allowed outside production only, or with `ALLOW_PRIVATE_ENDPOINTS=true`); `localhost`, `*.localhost` and any hostname that resolves to a loopback, private, link-local or multicast address is rejected before a single request is signed, unless `ALLOW_PRIVATE_ENDPOINTS=true` (see [SELF-HOSTING.md](./SELF-HOSTING.md)).
- **No IP logging.** Better Auth's IP tracking is switched off and the API logger never writes a client address.
- **Authorization from validated input only.** Every route parses its input with a zod schema first, then checks the caller's server role and the effective bucket role; handlers never read `req.body` or `req.query` directly.

## 🧩 Adding UI Components

```bash
cd packages/ui
pnpm dlx shadcn@latest add [component]
```

## 🖼️ Favicons

Every favicon, touch icon, manifest icon and `site.webmanifest` is generated from the brand mark (`apps/landing/public/logo.svg`) into **both** `apps/web/public` and `apps/landing/public`, because landing pages are proxied under the web app's domain and their root-relative icon URLs resolve against whichever app serves them. The same run mirrors the drawn logo files (`logo.svg`, `icons/viewer.svg`, `icons/viewerblue.svg`, `icons/whiteviewer.svg`) from landing into `apps/web/public` for the same reason — `next/image` leaves an `.svg` source untouched, so the browser asks whichever app served the page for it. The shared `<link>` tags live in `packages/ui/src/components/favicon-links.tsx`. Never hand-edit the outputs; change the SVG and run:

```bash
pnpm favicons
```

## 🏞️ Landing image assets

`pnpm landing:assets` (`scripts/optimize-landing-assets.ts`) recompresses the raster images and Lottie file under `apps/landing/public/landing` and regenerates `apps/landing/components/Landing/image-placeholders.ts`, the blur placeholders `next/image` uses for those assets. Re-run it after adding or replacing any image in that directory: a missing placeholder degrades to `placeholder="empty"` (see `apps/landing/lib/blur-placeholder.ts`) rather than breaking the page, but the new image renders unblurred until you do. The script resolves `sharp` by hand out of `node_modules/.pnpm` because it isn't a declared dependency anywhere it runs from, and fails with a clear error if `pnpm install` hasn't hoisted it.

## 📄 License

MIT © May Inc. See [LICENSE](./LICENSE).
