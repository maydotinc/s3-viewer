# Self-hosting S3 Viewer

## 1. The promise

S3 Viewer is open source, ground up. The hosted instance at s3-viewer.com uses
a specific set of providers, but every one of them has a drop-in open-source
or manual replacement, and the app code never assumes you're using them; it
only speaks standard protocols: Postgres wire protocol, SMTP, and the S3 API.

| Hosted instance uses | Self-hosted equivalent                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------ |
| Neon (Postgres)      | Plain Postgres, the bundled `postgres` compose service, or your own box                    |
| Resend               | Your own SMTP server (`EMAIL_TRANSPORT=smtp`), or no email at all (`EMAIL_TRANSPORT=none`) |
| Vercel               | Docker Compose + Caddy (`deploy/Caddyfile`) for TLS and reverse proxying                   |
| GitHub OAuth         | Optional everywhere; email and password sign-in needs no third party at all                |

None of this is a requirement to run the app; it's what every piece of the
hosted config maps to when you want to run your own.

## 2. Fastest path (Docker)

```bash
git clone https://github.com/maydotinc/s3-viewer && cd s3-viewer
docker compose up -d
```

This alone gives you a working install at `http://localhost:3000` with no
configuration: Postgres runs in its own container, the API generates and
persists its own secrets (`BETTER_AUTH_SECRET` and the RSA encryption key)
into a `/data` volume the first time it boots, and migrations are applied
automatically on every start.

`docker compose up -d` pulls the published `api` and `web` images from
`ghcr.io/maydotinc`. Add `--build` to build them from this checkout instead:

```bash
docker compose up -d --build
```

For a real deployment you'll want to set the two public URLs and, if you're
putting Caddy in front, the hostnames; see [Reverse proxy / Caddy](#reverse-proxy--caddy)
and the [env reference](#6-full-env-reference) below. Copy `.env.example` to
`.env` at the repo root to override any of it; every value has a working
default, so an untouched `.env` behaves the same as none at all.

Optional profiles layer on top:

```bash
# marketing site (set LANDING_ORIGIN, below)
docker compose --profile landing up -d

# Caddy TLS edge
docker compose -f docker-compose.yml -f docker-compose.proxy.yml --profile proxy up -d
```

The `proxy` profile always takes that second file. Compose cannot make one
service's environment depend on a profile, so `docker-compose.proxy.yml` is
where the API is told to trust Caddy for client IPs; without it every per-IP
rate limit sees Caddy's container address instead and shares one bucket
between all of your users. Profiles combine, so add `--profile landing` to
that same command to run everything.

## 3. Contributor path (pnpm)

```bash
git clone https://github.com/maydotinc/s3-viewer && cd s3-viewer
pnpm install
pnpm dev
```

If `apps/api/.env` doesn't exist yet, `pnpm dev` runs an interactive setup
wizard first, then continues straight into starting the apps. You can also
run the wizard on its own, any time, with:

```bash
pnpm run setup
```

(not bare `pnpm setup`; that's a pnpm built-in and does something else
entirely.)

The wizard asks, in order, pressing Enter takes the default shown in
brackets:

1. **Run Postgres in Docker for you?** (Y); otherwise it asks for a
   connection string to a database you manage.
2. **Catch outgoing email in a local inbox?** (Y); runs
   [mailpit](https://github.com/axllent/mailpit) in Docker and points
   `EMAIL_TRANSPORT=smtp` at it, so verification and reset links show up at
   `http://localhost:8025` instead of only in the terminal.
3. **Start a demo bucket to browse?** (N); runs a local MinIO with a
   `demo` bucket pre-seeded with a few sample objects, and sets
   `ALLOW_PRIVATE_ENDPOINTS=true` so S3 Viewer will accept its
   `localhost` endpoint.
4. **Run the marketing landing site too?** (N); writes `apps/landing/.env`
   and points `apps/web/.env`'s `LANDING_ORIGIN` at it.

It then generates `BETTER_AUTH_SECRET` and a 4096-bit RSA key pair with
Node's built-in `node:crypto` (no OpenSSL needed anywhere), writes
`apps/api/.env` and `apps/web/.env` (and `apps/landing/.env` if you chose
it) from their `.env.example` files, starts whichever Docker services you
picked, waits for Postgres to accept connections, and applies pending
migrations.

Found existing env files? The wizard asks whether to keep them (just start
services and migrate) or regenerate them; regenerating backs up each file to
`<file>.bak-<timestamp>` first, so nothing is silently lost. Non-interactive
flags: `--yes` (accept every default, keep existing env files if present,
used by CI and by `pnpm dev` itself when stdin isn't a TTY) and `--no-docker`
(paste your own Postgres connection string instead of running one in
Docker; combined with `--yes`, reads `DATABASE_URL` from the environment).

Once set up, `pnpm dev` loads `apps/api/.env` and `apps/web/.env`, makes sure
the Docker services you chose are running, applies any pending migrations,
and starts `web` on `:3000`, `api` on `:5001`, and `landing` on `:3001` if
you enabled it.

```bash
pnpm stop
```

stops whatever's listening on 3000, 5001 and 3001, and stops (not removes)
the dev Docker containers. `pnpm stop --down` also removes the containers;
add `--volumes` to that to drop the data too.

`pnpm db:deploy` / `db:migrate` / `db:generate` / `db:status` all load
`apps/api/.env` first, then run the matching Prisma command against
`packages/db`. `packages/db` itself needs no env file; `DATABASE_URL` always
comes from `apps/api/.env`.

Before opening a PR, run `pnpm lint && pnpm check-types && pnpm test`, and
`pnpm format` to apply Prettier.

## 4. Per-service setup

### Postgres (required)

The only hard requirement. Any Postgres 14+ works; the bundled container is
16 because that is what the hosted instance runs, not because a migration
needs it.

```yaml
# docker-compose.yml (already included)
postgres:
   image: postgres:16
   environment:
      POSTGRES_USER: s3viewer
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-s3viewer}
      POSTGRES_DB: s3viewer
```

Fills `DATABASE_URL` in `apps/api/.env`. In the Docker stack this is wired up
for you; the only thing you might change is `POSTGRES_PASSWORD` in the root
`.env`.

### Email (optional; `none` is a fully supported mode)

Three backends, chosen by `EMAIL_TRANSPORT` in `apps/api/.env`:

- **`none`**: nothing is sent. Sign-in still works; password reset, email
  verification and invites are unavailable, and the UI explains this
  wherever it would otherwise offer them (see the [capability matrix](#5-capability-matrix)).
  In development the message is still printed to the API log so you can copy
  a link by hand; in production it's dropped.
- **`smtp`**: point `SMTP_URL` at any SMTP server
  (`smtp://user:pass@mail.example.com:587`, or `smtps://…` for implicit TLS).
  Locally, `pnpm run setup`'s email question wires this up against a
  bundled [mailpit](https://github.com/axllent/mailpit) inbox at
  `http://localhost:8025`.
- **`resend`**: set `RESEND_KEY` to use [Resend](https://resend.com) directly.

Leaving `EMAIL_TRANSPORT` unset infers the mode: `resend` if `RESEND_KEY` is
set, else `smtp` if `SMTP_URL` is set, else `none`. Naming a transport
explicitly with nothing for it to connect to is a boot-time error, not a
silent no-op: `resend` needs `RESEND_KEY`, `smtp` needs `SMTP_URL`.
`EMAIL_FROM` is required in production for both real transports (there's no
default sender) and unused with `none`.

```yaml
mailpit:
   image: axllent/mailpit:latest
   ports: ["8025:8025", "1025:1025"]
```

Compose profile: `email` in `docker-compose.dev.yml` (dev only; the
production compose file has no mailpit service; point a real transport at a
real server).

### GitHub OAuth (optional)

The only switch is setting `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`
together in `apps/api/.env` (set one without the other and the API refuses
to boot). There's nothing to set in `apps/web/.env`; the web app shows the
GitHub button once `GET /config` reports `githubLoginEnabled: true`.

Register an OAuth app at <https://github.com/settings/developers> with this
**Authorization callback URL**:

```
https://api.s3-viewer.example.com/auth/callback/github
```

(locally, `http://localhost:5001/auth/callback/github`.)

### Demo MinIO / private endpoints (optional)

`pnpm run setup`'s demo-bucket question runs a local
[MinIO](https://min.io/) with a `demo` bucket seeded with a few sample
objects, so you have something to connect to and browse immediately:

- Endpoint to connect from S3 Viewer: `http://localhost:9000`
- Console: `http://localhost:9001`
- Access key / secret key: `minioadmin` / `minioadmin`
- Bucket: `demo`

This only works because the wizard also sets `ALLOW_PRIVATE_ENDPOINTS=true`.
S3 Viewer's SSRF guard normally rejects any endpoint that resolves to a
loopback, private, link-local or multicast address (and requires `https://`
in production). `ALLOW_PRIVATE_ENDPOINTS=true` turns that off, which is what
lets it accept `http://localhost:9000` at all, and also what a MinIO on your
own LAN needs. Leave it unset (the default, and the SSRF-safe setting) unless
you specifically need a private-network endpoint; the API logs a loud
warning at boot whenever it's on.

### Landing site (optional)

The marketing site at `apps/landing` is entirely optional. Unset
`LANDING_ORIGIN` in `apps/web/.env` and `/` on the web app redirects straight
to `/dashboard`; no landing container needed at all.

To run it: in the pnpm path, answer yes to `pnpm run setup`'s landing
question. In Docker, uncomment `LANDING_ORIGIN=http://landing:3001` in your
root `.env` (see the [env reference](#6-full-env-reference)) so the web app
knows to proxy the marketing routes from it, and add the `landing` profile:

```bash
docker compose --profile landing up -d
```

There is no published landing image: the site inlines `SITE_URL` into its
canonical, Open Graph and JSON-LD URLs when it is compiled, so a prebuilt one
could only ever be correct for a single domain. Compose builds it from this
checkout the first time you enable the profile, and `--build` rebuilds it
after `SITE_URL` changes.

The landing container never needs a hostname, a certificate or a published
port. The web app proxies its pages **and** its assets: landing builds every
`/_next/*` URL under the path `/landing-assets`, and
`apps/web/middleware.ts` forwards `/landing-assets/*` straight back to
`LANDING_ORIGIN`, so the browser only ever talks to the web app's origin.
`LANDING_ORIGIN` is therefore an internal address — the compose service name
is exactly right.

Only a landing deployment that serves its own assets from its own public
origin (the hosted Vercel one) needs `NEXT_PUBLIC_ASSET_PREFIX`; setting it
overrides the path prefix with that origin. It is inlined at build time, so
it has to be set for `pnpm build` / the Docker build, not just at runtime.

### Reverse proxy / Caddy

The `proxy` compose profile runs [Caddy](https://caddyserver.com/) with
[`deploy/Caddyfile`](./deploy/Caddyfile), terminating TLS for your own
hostnames and forwarding to the `web` and `api` containers over the compose
network:

```bash
docker compose -f docker-compose.yml -f docker-compose.proxy.yml --profile proxy up -d
```

Set `SITE_HOSTNAME`, `API_HOSTNAME` and `ACME_EMAIL` in the root `.env`
first. Without them Caddy still starts, serving `localhost` with a
self-signed certificate instead of asking Let's Encrypt for one it could
never validate.

The `-f docker-compose.proxy.yml` overlay is not optional garnish: it sets
`TRUST_PROXY=1`, without which the API reads every request's IP as Caddy's
container address and all of its per-IP rate limits (10 sign-ups an hour,
among others) collapse into one bucket shared by the whole internet. One hop
is the right number because Caddy's `reverse_proxy` ignores the
`X-Forwarded-*` headers on an incoming request and writes `X-Forwarded-For`
itself, so a client cannot forge its own address. Adding a `trusted_proxies`
global option to the Caddyfile reverses that — Caddy then keeps incoming
values — so only add it when something you control really is in front, and
raise `TRUST_PROXY` to match. See the
[`TRUST_PROXY` warning](#7-production-notes) below.

Behind a proxy of your own instead of this profile, set `TRUST_PROXY`
yourself in the root `.env`; the overlay only exists because compose has no
way to vary one service's environment by profile.

Any reverse proxy works, not just Caddy (nginx, Traefik and a cloud load
balancer all qualify), as long as it terminates HTTPS for both hostnames and
forwards to the `web` and `api` containers (or processes).

## 5. Capability matrix

| Missing                                                                                | Capability off                               | What the user sees                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A mail transport (`EMAIL_TRANSPORT=none`, the default with no `RESEND_KEY`/`SMTP_URL`) | Password reset, email verification, invites  | Sign-in and everyday use are unaffected. "Forgot password?" shows **"Password reset is unavailable"**: _"This instance has no email configured, so a reset link can't be sent. Ask whoever runs it to set up email or to reset your password for you."_ Settings → Profile shows **"Not verified. This instance has no email configured, so verification is unavailable."** instead of a resend link. Any callout that would normally ask you to verify your email says instead: _"Email isn't configured on this instance, so verification is unavailable. You can't \[action\] until your address is verified."_ The **Invite** button on Settings → Sent is hidden entirely, and that card shows **"This instance has no email configured, so invites can't be sent."** The invite dialog (opened from a server's Share menu) shows the same message and disables its submit button. Signing up shows a toast: _"This instance has no email configured, so your address stays unverified."_ |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`                                            | GitHub sign-in                               | The "Continue with GitHub" button is absent from the login and sign-up screens; email and password work as normal.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `LANDING_ORIGIN`                                                                       | The marketing site                           | `/` redirects straight to `/dashboard`. No landing container needs to run at all.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| The `proxy` profile / no reverse proxy in front                                        | TLS                                          | The stack serves plain HTTP on `localhost:3000` / `localhost:5001`. Fine for local use or when you run your own proxy in front; session cookies need HTTPS in production once real users are involved.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `ALLOW_PRIVATE_ENDPOINTS` (unset, the default)                                         | Connecting to a private/loopback S3 endpoint | Adding a server whose endpoint resolves to `localhost`, a private range, or link-local/multicast is rejected before a request is even signed. This is what protects a public-facing instance from SSRF; only set `ALLOW_PRIVATE_ENDPOINTS=true` on a trusted network (a LAN MinIO, the demo bucket).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

A disabled capability always means the UI explains itself in place, rather
than a button that silently does nothing or a request that fails with an
opaque error.

## 6. Full env reference

### `apps/api/.env`

| Variable                  |                  Required                   | Local value                                                             | Production value                                                         | What it does                                                                                                                                                                                                                                                                        |
| ------------------------- | :-----------------------------------------: | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`            |                     ✅                      | `postgresql://…`                                                        | `postgresql://…`                                                         | PostgreSQL connection string for Prisma.                                                                                                                                                                                                                                            |
| `BETTER_AUTH_SECRET`      |           only without `DATA_DIR`           | generated by the wizard                                                 | generated by the wizard, or set by hand                                  | Signs sessions and tokens; at least 32 characters. With `DATA_DIR` set, generated on first boot and persisted to `$DATA_DIR/auth-secret`.                                                                                                                                           |
| `ENCRYPTION_PRIVATE_KEY`  |           only without `DATA_DIR`           | generated by the wizard                                                 | generated by the wizard, or set by hand                                  | RSA private key (2048 bits or more; 4096 is what's generated) that decrypts stored S3 credentials. The public half is derived from it at runtime and served on `GET /config`. With `DATA_DIR` set, generated on first boot and persisted to `$DATA_DIR/encryption-private-key.pem`. |
| `DATA_DIR`                |                                             | unset                                                                   | `/data` (set by the Docker image)                                        | Writable directory where generated secrets are persisted, so a container comes back with the same keys across restarts.                                                                                                                                                             |
| `NEXT_PUBLIC_SITE_URL`    |                     ✅                      | `http://localhost:3000`                                                 | `https://s3-viewer.example.com`                                          | The web app's origin: CORS, the `Origin` check, trusted origins and email links.                                                                                                                                                                                                    |
| `NEXT_PUBLIC_API_URL`     |                     ✅                      | `http://localhost:5001`                                                 | `https://api.s3-viewer.example.com`                                      | This API's own origin: Better Auth base URL, OAuth callbacks, `Secure` cookies.                                                                                                                                                                                                     |
| `NODE_ENV`                |                                             | `development`                                                           | `production`                                                             | Also gates whether a cleartext `http://` S3 endpoint is accepted outside of `ALLOW_PRIVATE_ENDPOINTS=true`.                                                                                                                                                                         |
| `EMAIL_TRANSPORT`         |                                             | `smtp` (mailpit) or `none`, whichever the wizard's email question chose | `resend`, `smtp` or `none`                                               | Which mail transport sends auth and invite email. The wizard always writes one of the two explicitly rather than leaving it to inference. Unset ⇒ `resend` if `RESEND_KEY` is set, else `smtp` if `SMTP_URL` is set, else `none`. `none` is intentional and fully supported.        |
| `SMTP_URL`                |          if `EMAIL_TRANSPORT=smtp`          | `smtp://localhost:1025` (mailpit)                                       | `smtp://user:pass@mail.example.com:587`                                  | SMTP connection string (`smtp://` or `smtps://`). Required in every environment when `EMAIL_TRANSPORT=smtp`; ignored otherwise.                                                                                                                                                     |
| `RESEND_KEY`              |         if `EMAIL_TRANSPORT=resend`         | unset                                                                   | `re_…`                                                                   | Resend API key. Required when `EMAIL_TRANSPORT=resend`; ignored otherwise.                                                                                                                                                                                                          |
| `EMAIL_FROM`              | if a transport is configured, in production | unset                                                                   | `S3 Viewer <hello@yourdomain.com>`                                       | Sender for auth and invite email. Required in production when `resend` or `smtp` is configured; there is no default sender, so a self-hosted deploy never sends mail claiming to be from May Inc. Not needed with `EMAIL_TRANSPORT=none`.                                           |
| `SUPPORT_EMAIL`           |                                             | unset                                                                   | `support@yourdomain.com`                                                 | Contact shown to admins who hit the pending-invite cap, and in the account-deletion confirmation email. Unset ⇒ omitted; the email points at GitHub issues instead.                                                                                                                 |
| `GITHUB_CLIENT_ID`        |                                             | unset                                                                   | GitHub OAuth app id                                                      | Set together with the secret, or leave both unset. The only switch for GitHub login.                                                                                                                                                                                                |
| `GITHUB_CLIENT_SECRET`    |                                             | unset                                                                   | GitHub OAuth app secret                                                  | Set together with the id, or leave both unset.                                                                                                                                                                                                                                      |
| `ALLOW_PRIVATE_ENDPOINTS` |                                             | unset, or `true` if the wizard's demo-bucket question is yes            | unset                                                                    | Exactly `true` lets S3 endpoints resolve to private, loopback or link-local addresses (a MinIO on your LAN, the local demo bucket) and allows `http://` in production too. Default false, which is the SSRF-safe setting. Logs a loud boot warning when true.                       |
| `PORT`                    |                                             | `5001`                                                                  | `5001`                                                                   | Port the API listens on.                                                                                                                                                                                                                                                            |
| `TRUST_PROXY`             |                                             | `loopback`                                                              | `1` behind a single reverse proxy (`docker-compose.proxy.yml` sets this) | Express `trust proxy`; behind a load balancer use the hop count. See the [warning](#7-production-notes) below before changing this.                                                                                                                                                 |
| `MAX_UPLOAD_BYTES`        |                                             | `5368709120`                                                            | `5368709120`                                                             | Largest upload body in bytes, enforced while streaming so a false `Content-Length` cannot bypass it. Unset ⇒ 5 GiB.                                                                                                                                                                 |
| `UPLOAD_PART_BYTES`       |                                             | `26214400`                                                              | `26214400`                                                               | Multipart part size in bytes. Unset ⇒ 25 MiB. Min 5 MiB, max 5 GiB. A known `Content-Length` raises the part size when needed to stay under S3's 10,000-part cap.                                                                                                                   |
| `LOG_LEVEL`               |                                             | `debug`                                                                 | `warn`                                                                   | `debug`, `info`, `warn` or `error`. Unset ⇒ `warn` in production, `debug` otherwise.                                                                                                                                                                                                |

### `apps/web/.env`

| Variable               | Required | Local value                                                                 | Production value                                                  | What it does                                                                                                                                                           |
| ---------------------- | :------: | --------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL` |    ✅    | `http://localhost:3000`                                                     | `https://s3-viewer.example.com`                                   | This app's own origin: auth redirects, canonical URLs and the sitemap. Read at runtime, not baked in at build time.                                                    |
| `NEXT_PUBLIC_API_URL`  |    ✅    | `http://localhost:5001`                                                     | `https://api.s3-viewer.example.com`                               | Where every request goes, and where `GET /config` is fetched from. Read at runtime, not baked in at build time.                                                        |
| `LANDING_ORIGIN`       |          | `http://localhost:3001` if the wizard's landing question is yes, else unset | `http://landing:3001` (Docker) or the landing deployment's origin | Landing deployment to proxy the marketing routes **and** `/landing-assets/*` from; internal-only, never reached by the browser. Unset ⇒ `/` redirects to `/dashboard`. |

The encryption public key and whether GitHub login is available are **not**
environment variables here any more; both come from the API's `GET /config`
at runtime, so one prebuilt web image works for every install.

### `apps/landing/.env`

| Variable                   | Required | Local value             | Production value                | What it does                                                                                                                                                                                                                                                                                                                  |
| -------------------------- | :------: | ----------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`     |    ✅    | `http://localhost:3000` | `https://s3-viewer.example.com` | The public origin this site is proxied under: canonical, OG and absolute links.                                                                                                                                                                                                                                               |
| `NEXT_PUBLIC_ASSET_PREFIX` |          | unset                   | unset                           | Leave unset: `/_next/*` is then served under the path `/landing-assets`, which the web app proxies back here. Set it to this deployment's own public origin only when the browser should fetch the assets from here directly. Inlined at build time; must be set before `pnpm build` / the Docker build, not just at runtime. |

### Root `.env` (Docker Compose only)

Read only by `docker compose`; contributors running `pnpm dev` never need
this file. Every value has a working default, so `docker compose up -d`
serves `http://localhost:3000` with no `.env` at all. Copy `.env.example` to
`.env` at the repo root to override any of it.

| Variable                  | Default                 | What it does                                                                                                                                 |
| ------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `SITE_URL`                | `http://localhost:3000` | Public origin of the web app: what people type in the browser.                                                                               |
| `API_URL`                 | `http://localhost:5001` | Public origin of the API: must be reachable from the browser, not just from `web`.                                                           |
| `POSTGRES_PASSWORD`       | `s3viewer`              | Password for the bundled Postgres container.                                                                                                 |
| `TRUST_PROXY`             | unset (⇒ `loopback`)    | Passed through to the API; `docker-compose.proxy.yml` makes it `1`. Setting it here overrides both, for a proxy of your own or a second hop. |
| `BETTER_AUTH_SECRET`      | unset (⇒ generated)     | Only for migrating an existing install: overrides the secret the API generates into its `/data` volume. Existing sessions survive.           |
| `ENCRYPTION_PRIVATE_KEY`  | unset (⇒ generated)     | Only for migrating an existing install: the RSA key that decrypts already-stored S3 credentials. See the one-line PEM note below.            |
| `LANDING_ORIGIN`          | unset                   | Origin of the landing container; set it to `http://landing:3001` with the `landing` profile. Leave commented out (not blank) otherwise.      |
| `SITE_HOSTNAME`           | unset                   | Hostname Caddy serves the web app on (`proxy` profile).                                                                                      |
| `API_HOSTNAME`            | unset                   | Hostname Caddy serves the API on (`proxy` profile).                                                                                          |
| `ACME_EMAIL`              | unset                   | Address Let's Encrypt notifies about expiring certificates (`proxy` profile).                                                                |
| `EMAIL_TRANSPORT`         | unset (⇒ inferred)      | `none`, `resend` or `smtp`; see the [`apps/api/.env` table](#appsapienv) above.                                                              |
| `RESEND_KEY`              | unset                   | Resend API key; sending email switches on as soon as this is set.                                                                            |
| `SMTP_URL`                | unset                   | SMTP connection string.                                                                                                                      |
| `EMAIL_FROM`              | unset                   | From address on outgoing email.                                                                                                              |
| `SUPPORT_EMAIL`           | unset                   | Contact shown to admins who hit the pending-invite cap.                                                                                      |
| `GITHUB_CLIENT_ID`        | unset                   | GitHub OAuth app client id; set both id and secret or neither.                                                                               |
| `GITHUB_CLIENT_SECRET`    | unset                   | GitHub OAuth app client secret.                                                                                                              |
| `ALLOW_PRIVATE_ENDPOINTS` | unset                   | `true` allows S3 endpoints on private/loopback addresses (a LAN MinIO).                                                                      |
| `MAX_UPLOAD_BYTES`        | unset (⇒ 5 GiB)         | Largest upload body in bytes.                                                                                                                |
| `UPLOAD_PART_BYTES`       | unset (⇒ 25 MiB)        | Multipart part size in bytes. Min 5 MiB, max 5 GiB.                                                                                          |
| `LOG_LEVEL`               | unset (⇒ `warn`)        | `debug`, `info`, `warn` or `error`.                                                                                                          |

Leave an unwanted line commented out rather than setting it to an empty
string; compose treats an empty value as a value, not as unset.

A multi-line PEM cannot span lines in this file. Put the whole key on one
line, **in double quotes**, with `\n` where the newlines were:

```dotenv
ENCRYPTION_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIJQ…\n-----END PRIVATE KEY-----\n"
```

Compose expands `\n` inside double quotes and leaves it literal outside them,
so the quotes are what makes this work. `docker compose config` prints the
key back as a block of real lines when you've got it right.

## 7. Production notes

- **Migrations run automatically, but plan around them anyway.** The Docker
  API image's entrypoint waits for Postgres to accept TCP connections, then
  runs `prisma migrate deploy` on every single boot, before starting the
  server; you don't have to run migrations by hand in the Docker path.
  Outside Docker, run `pnpm db:deploy` before starting the new version.
  Migrations are written additive-first (new columns carry defaults), so
  migrating before or after you deploy the code both work. Two migrations
  need an operator's attention rather than a blind deploy:

   - **`20260903020000_lowercase_existing_emails`** aborts with a `RAISE
EXCEPTION` if two accounts collide once their addresses are lowercased
     (`ada@x.com` and `Ada@x.com`). It names the offending addresses; merge or
     delete one of each pair, then re-run. It is deliberately fail-loud rather
     than picking a winner for you.
   - **`20260904020000_drop_account_dedupe_backup`** removes the
     `account_dedupe_backup` table that `20260903000000_account_provider_account_unique`
     left behind when it deduplicated `account` rows. That table has
     `accessToken`, `refreshToken`, `idToken` and `password` columns, so
     leaving it in place keeps OAuth tokens in plaintext indefinitely — but
     the drop only runs when it is **empty**. If it still holds rows the
     migration aborts with a `RAISE EXCEPTION` naming the count, rather than
     destroying the only copy of a sign-in link the dedupe revoked. On a
     database that never had duplicates (every fresh install) it is empty and
     this is a silent no-op. If it stops you, inspect the rows, restore or
     discard them by hand, then re-run:

      ```sql
      SELECT * FROM "account_dedupe_backup";
      -- once you're sure nobody lost a sign-in link
      DROP TABLE "account_dedupe_backup";
      ```

- **`TRUST_PROXY` warning.** All per-IP rate limits key off the IP Express
  derives from this setting. Set it to the exact number of reverse proxies in
  front of the API, e.g. `TRUST_PROXY=1` for a single load balancer or
  nginx/Caddy instance that overwrites `X-Forwarded-For`, and confirm that
  proxy strips or replaces any client-supplied `X-Forwarded-For` rather than
  appending to it. If you instead set `TRUST_PROXY=true` (or too high a hop
  count) behind a proxy that does not strip that header, any client can forge
  its own `X-Forwarded-For` and get a fresh rate-limit bucket on every
  request, making every per-IP limit trivially bypassable. When unsure, leave
  it at `loopback` and put the API behind a proxy you configure yourself. The
  bundled Caddy qualifies: `reverse_proxy` ignores incoming `X-Forwarded-*`
  and writes the header itself, which is why
  [`docker-compose.proxy.yml`](#reverse-proxy--caddy) can set `1` for you.
  Leaving that file off the command line is the failure mode to watch for —
  the API then sees only Caddy's container address, so every per-IP limit
  becomes one global limit shared by every visitor.

- **Rate limiting is in-memory and per-instance.** `express-rate-limit` uses
  the default in-memory store; there is no shared Redis/store backing it.
  Run N API instances behind a load balancer and the effective limit is N×
  the documented number, and every counter resets on restart or redeploy.
  Treat the numbers as a soft ceiling, not a hard guarantee.

- **A broken mail provider fails silently to the client.** Verification and
  reset links are sent after the request has already succeeded, and the
  response never reveals whether an address has an account, so a mail
  failure surfaces only as an error-level log line (`[auth] verify email
failed` / `[auth] reset email failed`). Alert on those lines, not on
  client-visible errors.

- **SSRF guard / egress.** Server endpoints are checked up front and again at
  connect time via a custom DNS lookup, closing a DNS-rebinding gap (see
  [README → Security](./README.md#security)). That protects against
  DNS-based SSRF specifically, not against every route a misconfigured or
  malicious endpoint could reach; self-hosters should still restrict egress
  at the network layer (run the API in a network segment / security group
  that cannot reach internal services) as defense in depth.

- **Backups.** Two things make up your data, and both need to survive:

   - **Postgres** holds everything: accounts, servers, memberships,
     encrypted credentials, the audit log. Back it up on a schedule
     (`pg_dump`, or your provider's point-in-time recovery).
   - **`$DATA_DIR/encryption-private-key.pem`** (the `/data` volume in
     Docker) is the only thing that can decrypt the credential blobs stored
     in Postgres. Back it up alongside your database. **Losing this file
     makes every stored S3 credential permanently unreadable**: there is no
     recovery path, and every user would need to reconnect their servers from
     scratch. If you set `ENCRYPTION_PRIVATE_KEY` yourself instead of relying
     on `DATA_DIR` generation, back up wherever you keep that value instead.

- **Audit log retention.** The audit log is never pruned automatically and
  has no foreign keys, so it grows without bound by design. Set a retention
  window that suits your jurisdiction, for example a nightly:

   ```sql
   DELETE FROM "audit_log" WHERE "createdAt" < now() - interval '1 year';
   ```

## 8. Updating

Docker path:

```bash
git pull
docker compose pull
docker compose up -d
```

(`docker compose pull` is a no-op, harmlessly, if you're running
`--build` images instead; rebuild with `docker compose up -d --build`.)
Migrations run automatically on the API container's next boot.

pnpm path:

```bash
git pull
pnpm install
pnpm dev
```

`pnpm dev` applies any pending migrations before starting the apps, same as
always.

### Upgrading from an earlier version

Three things changed shape in the self-hosting overhaul. All of them are
config, none of them touch your data.

- **A named mail transport with nothing behind it is now a boot error.**
  `EMAIL_TRANSPORT=resend` without `RESEND_KEY`, or `EMAIL_TRANSPORT=smtp`
  without `SMTP_URL`, used to start fine and silently drop every message.
  The API now refuses to boot and says which value is missing. If that stops
  an upgrade, either supply the credential or set `EMAIL_TRANSPORT=none`,
  which is a supported mode rather than a failure (see the
  [capability matrix](#5-capability-matrix)).
- **`NEXT_PUBLIC_ENCRYPTION_PUBLIC_KEY` and `NEXT_PUBLIC_GITHUB_LOGIN_ENABLED`
  are no longer read.** The web app gets the encryption public key and
  whether GitHub sign-in is available from the API's `GET /config` at
  runtime, so one prebuilt image works for every install. Delete both lines
  from `apps/web/.env`; leaving them behind changes nothing, but they are
  dead. GitHub sign-in is now switched on solely by setting
  `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` on the API.
- **`packages/db` no longer needs an env file.** `DATABASE_URL` always comes
  from `apps/api/.env`, which the `db:*` scripts load before running Prisma.
  Delete `packages/db/.env` if you have one.

Moving an existing install onto the Docker stack? The API generates
`BETTER_AUTH_SECRET` and its RSA key into the `/data` volume on first boot,
which would invalidate every session and, worse, orphan every stored S3
credential. Carry the old values over instead: both are optional passthroughs
on the `api` service, so set them in the root `.env` (the
[table above](#root-env-docker-compose-only) covers the one-line PEM form)
and the container uses yours rather than generating new ones.

## Also see

- [`README.md`](./README.md): quickstart, features, architecture.
- [`CONTRACTS.md`](./CONTRACTS.md): the engineering agreement between the
  API, the web app, the landing site and the shared packages.
- [`SECURITY.md`](./SECURITY.md): how to report a vulnerability.
