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

Create an account in the app. The default install sends no email, so use the
[operator verification command](#verify-an-account-without-email), then sign
in again before connecting a server.

`docker compose up -d` pulls the published `api` and `web` images from
`ghcr.io/maydotinc`. Add `--build` to build them from this checkout instead:

```bash
docker compose up -d --build
```

Building needs BuildKit, the default builder since Docker 23
(`DOCKER_BUILDKIT=0` will not work). The API image is about 390 MB: the
compiled server, the Prisma migrations, a generated client with its query
engine, the Prisma CLI that the entrypoint runs `migrate deploy` with on every
boot, and the email stack (`react-dom/server` is CommonJS, so it stays
unbundled). Everything else is pruned at build time, so pnpm and the Prisma CLI
are present but the rest of the dependency tree is not.

For a real deployment you'll want to set the two public URLs and, if you're
putting Caddy in front, the hostnames; see [Reverse proxy / Caddy](#reverse-proxy--caddy)
and the [env reference](#7-full-env-reference) below. Copy `.env.example` to
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

`pnpm` is the only package manager this repo supports, and the version in
`package.json`'s `packageManager` field is the one it expects. On Node 24 and
older, `corepack enable` installs shims that fetch that pinned version on first
use (`corepack up` if it complains about a signature or keyid); Node 25 and
newer ship without Corepack, so there you install pnpm directly with
`npm i -g pnpm`.

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
  verification and invites are unavailable. An operator can verify an account
  using the console command below so it can connect a server; the UI explains this
  wherever it would otherwise offer them (see the [capability matrix](#6-capability-matrix)).
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

### Verify an account without email

The instance operator can verify a specific account from the API console.
Create the account in the app first, then inspect it:

```bash
# Docker Compose
docker compose exec api node dist/verify-email.js you@example.com
# Source checkout
pnpm account:verify you@example.com
# Render (or another platform): in the running API service shell
node dist/verify-email.js you@example.com
```

Inspection prints the account id and creation time and changes nothing.
Verify your own account or independently confirm the intended person's
ownership of the account and email address; the address alone is not proof.
Repeat the same command with the printed account id as its second argument:

```bash
docker compose exec api node dist/verify-email.js you@example.com ACCOUNT_ID
```

This verifies only that account, revokes its sessions, and records an
`account.verify` audit event. Sign in again to connect a server. There is no
public verification endpoint or automatic first-user exemption. Password
recovery and invites still need an email transport.

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
root `.env` (see the [env reference](#7-full-env-reference)) so the web app
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
[`TRUST_PROXY` warning](#8-production-notes) below.

Behind a proxy of your own instead of this profile, set `TRUST_PROXY`
yourself in the root `.env`; the overlay only exists because compose has no
way to vary one service's environment by profile.

Any reverse proxy works, not just Caddy (nginx, Traefik and a cloud load
balancer all qualify), as long as it terminates HTTPS for both hostnames and
forwards to the `web` and `api` containers (or processes).

### Health checks

Both images carry their own `HEALTHCHECK` (node's built-in `fetch`, so no
curl or wget in the runtime images), which is what `docker compose ps`,
`docker run`, Coolify, Portainer and the platform templates below all read.

| Service | Path          | Returns                        |
| ------- | ------------- | ------------------------------ |
| api     | `/health`     | `{"ok":true,"apiVersion":<n>}` |
| web     | `/api/health` | `{"ok":true}`                  |

Both are unauthenticated, uncached and cheap; the web one is a liveness check
that never touches the API or the database. Probes follow a `PORT` override,
run every 10s with 5 retries after a start period of 120s on the API (Postgres
wait plus migrations) and 20s on the web app, and log the connection error to
`docker inspect`'s health log when they fail, and `docker-compose.yml` makes `web` wait for a
healthy `api`, so the first page load never races a migration still running.

## 5. Platform deploys

Templates for the four platforms people ask about live in this repo. They all
run the same two images — `api` on `:5001` with `GET /health`, `web` on `:3000`
with `GET /api/health` — against a managed Postgres, and they all need the same
four things:

- **Both public URLs, as full origins with a scheme.** `NEXT_PUBLIC_SITE_URL`
  and `NEXT_PUBLIC_API_URL` are validated as URLs at boot, so a bare hostname
  fails; and `NEXT_PUBLIC_SITE_URL` has to be exactly what people type in the
  browser, because it is what the API allows through CORS and the `Origin`
  check. Set both on **both** services.
- **A persistent volume mounted at `/data` on the API**, with `DATA_DIR=/data`.
  That is where it generates and keeps `BETTER_AUTH_SECRET` and the RSA key
  that decrypts stored credentials; see [Backups](#8-production-notes).
- **`TRUST_PROXY=1`.** All four put exactly one proxy in front of the API.
- **`COOKIE_SAMESITE=none` on the API, on a platform's default hostname.**
  `onrender.com`, `fly.dev` and `up.railway.app` are public suffixes, so
  `s3-viewer-web.fly.dev` and `s3-viewer-api.fly.dev` are different _sites_,
  not just different origins: the default `SameSite=Lax` session cookie is
  never sent to the API and every sign-in bounces straight back to `/login`.
  The templates already set it. Put both apps on one registrable domain
  (`app.example.com` and `api.example.com`) and they are same-site again, so
  drop back to `lax`. What keeps `none` safe is the `Origin` check the API runs
  on every non-`GET` request: a cookie that travels cross-site still cannot
  drive a state change from a page that is not `NEXT_PUBLIC_SITE_URL`.

Everything else is optional and lives once in the
[env reference](#7-full-env-reference). Migrations run in the API container's
entrypoint, so none of these need a release or pre-deploy command. The landing
site has no published image and is deliberately absent from all four.

### Render

[`render.yaml`](./render.yaml) is a Blueprint: the two Docker services, a
managed Postgres and a 1 GB disk on the API.

1. Use the **Deploy to Render** button in the README, or **New → Blueprint** in
   the dashboard against your fork.
2. Render prompts once for the two `sync: false` variables. Paste the origins
   the services are about to get: `https://s3-viewer-web.onrender.com` for
   `NEXT_PUBLIC_SITE_URL` and `https://s3-viewer-api.onrender.com` for
   `NEXT_PUBLIC_API_URL`. Render's cross-service references only yield a host,
   never a full origin, which is why these are typed rather than wired.
3. If either service name was taken Render appends a suffix. Correct both
   values on both services under **Environment** and redeploy — likewise when
   you point a custom domain at the web service.
4. `/data` is the disk on `s3-viewer-api`. Blueprint updates ignore
   `sync: false` variables, so those two are only ever changed by hand.

A disk needs a paid instance type, so the API cannot run on `free` and stays at
one instance; the web service can drop to `plan: free` if you accept it
spinning down when idle. **Update**: push to your fork's default branch, or
**Manual Deploy** in the dashboard.

### Fly.io

Two apps plus Fly Managed Postgres. Run everything from the repo root so the
build context is the whole monorepo:

```bash
fly apps create s3-viewer-api
fly apps create s3-viewer-web
fly mpg create                                  # note the cluster id it prints
fly mpg attach <cluster-id> -a s3-viewer-api    # sets the DATABASE_URL secret
fly volumes create s3_viewer_data -a s3-viewer-api -s 1 -r iad
fly deploy -c deploy/fly/api.toml --dockerfile apps/api/Dockerfile --ha=false
fly deploy -c deploy/fly/web.toml --dockerfile apps/web/Dockerfile
```

Edit `app` and `primary_region` in [`deploy/fly/api.toml`](./deploy/fly/api.toml)
and [`deploy/fly/web.toml`](./deploy/fly/web.toml) first, then the two
`NEXT_PUBLIC_*` values in the `[env]` block of both files, to the
`https://<app>.fly.dev` origins Fly gave you or to your own domains. Credentials
(`RESEND_KEY`, `SMTP_URL`, `GITHUB_CLIENT_SECRET`) belong in `fly secrets set`,
not in `[env]`. `--ha=false` on the API matters: only one machine can mount the
`/data` volume, and Fly otherwise creates a spare. **Update**: `fly deploy`
again with the same flags.

### Railway

There is no Railway template id for S3 Viewer to click, and no config file in
this repo either: Railway deprecated `railway.json` / `railway.toml` in favour
of an `.railway/railway.ts` Infrastructure-as-Code file that needs its own npm
package and CLI, and the old format stops being read on 2026-12-01. Six clicks
per service is less to rot than either, so:

1. **New Project → Deploy from GitHub repo**, then **+ New → Database →
   PostgreSQL**.
2. Add two services from the same repo. On both, leave **Root Directory** at
   `/` — the Dockerfiles need the whole monorepo as their build context — and
   under **Settings → Build** choose the **Dockerfile** builder with
   `apps/api/Dockerfile` on one and `apps/web/Dockerfile` on the other.
3. Under **Settings → Deploy**, set the health check path (`/health` for the
   API, `/api/health` for the web app) and a restart policy of **On failure**.
   Keep the API at one replica; it has a volume.
4. Give both services a public domain under **Settings → Networking**.
5. On the API service add a volume mounted at `/data`, and set
   `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `DATA_DIR=/data`,
   `TRUST_PROXY=1` and `COOKIE_SAMESITE=none`.
6. Set the two URLs on **both** services. `RAILWAY_PUBLIC_DOMAIN` is a bare
   hostname, so add the scheme yourself:

   ```dotenv
   NEXT_PUBLIC_SITE_URL=https://${{web.RAILWAY_PUBLIC_DOMAIN}}
   NEXT_PUBLIC_API_URL=https://${{api.RAILWAY_PUBLIC_DOMAIN}}
   ```

   substituting whatever you actually named the services and the database.

**Update**: push to the branch each service watches, or **Redeploy**.

### Coolify / Portainer

Neither needs a file of its own: [`docker-compose.yml`](./docker-compose.yml)
_is_ the stack. Both run their own reverse proxy (Traefik, in Coolify's case)
which reaches `web` and `api` over the stack's Docker network, so the
`127.0.0.1:3000` / `127.0.0.1:5001` bindings in that file are already right —
leave them, and do **not** enable the `proxy` profile, which would start a
second TLS edge competing for `:443`.

**Coolify**: create a resource from this repo with the **Docker Compose** build
pack, leave **Base Directory** at `/` and set **Docker Compose Location** to
`/docker-compose.yml`. Coolify lists the services once it parses the file;
assign one domain to `web` and one to `api`, writing the container port in the
domain (`https://app.example.com:3000`) so Traefik routes to something other
than `:80`. **Update**: Redeploy, or turn on automatic deployments.

**Portainer**: **Stacks → Add stack → Git Repository**, **Compose path**
`docker-compose.yml`, and put the variables under **Environment variables**.
Portainer has no certificate story of its own, so terminate TLS in a proxy in
front of it. **Update**: _Pull and redeploy_, or enable **GitOps updates**.

Both read the root `.env` variables, not the app ones, so the table to work
from is [Root `.env`](#root-env-docker-compose-only): set `SITE_URL` and
`API_URL` to the two public origins, `POSTGRES_PASSWORD` to something of your
own, and `TRUST_PROXY=1`.

## 6. Capability matrix

| Missing                                         | Capability off                                      | What the user sees                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email transport (`none`, the default)           | Emailed verification, password recovery and invites | Sign-in works. Before connecting a server, the operator must [verify the account from the API console](#verify-an-account-without-email), then the user signs in again. Verification callouts explain this; password reset and invitations explain that email must be configured.                    |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`     | GitHub sign-in                                      | The "Continue with GitHub" button is absent from the login and sign-up screens; email and password work as normal.                                                                                                                                                                                   |
| `LANDING_ORIGIN`                                | The marketing site                                  | `/` redirects straight to `/dashboard`. No landing container needs to run at all.                                                                                                                                                                                                                    |
| The `proxy` profile / no reverse proxy in front | TLS                                                 | The stack serves plain HTTP on `localhost:3000` / `localhost:5001`. Fine for local use or when you run your own proxy in front; session cookies need HTTPS in production once real users are involved.                                                                                               |
| `ALLOW_PRIVATE_ENDPOINTS` (unset, the default)  | Connecting to a private/loopback S3 endpoint        | Adding a server whose endpoint resolves to `localhost`, a private range, or link-local/multicast is rejected before a request is even signed. This is what protects a public-facing instance from SSRF; only set `ALLOW_PRIVATE_ENDPOINTS=true` on a trusted network (a LAN MinIO, the demo bucket). |

A disabled capability always means the UI explains itself in place, rather
than a button that silently does nothing or a request that fails with an
opaque error.

## 7. Full env reference

### `apps/api/.env`

| Variable                     |                  Required                   | Local value                                                             | Production value                                                         | What it does                                                                                                                                                                                                                                                                                                                           |
| ---------------------------- | :-----------------------------------------: | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`               |                     ✅                      | `postgresql://…`                                                        | `postgresql://…`                                                         | PostgreSQL connection string for Prisma.                                                                                                                                                                                                                                                                                               |
| `BETTER_AUTH_SECRET`         |           only without `DATA_DIR`           | generated by the wizard                                                 | generated by the wizard, or set by hand                                  | Signs sessions and tokens; at least 32 characters. With `DATA_DIR` set, generated on first boot and persisted to `$DATA_DIR/auth-secret`.                                                                                                                                                                                              |
| `ENCRYPTION_PRIVATE_KEY`     |           only without `DATA_DIR`           | generated by the wizard                                                 | generated by the wizard, or set by hand                                  | RSA private key (2048 bits or more; 4096 is what's generated) that decrypts stored S3 credentials. The public half is derived from it at runtime and served on `GET /config`. With `DATA_DIR` set, generated on first boot and persisted to `$DATA_DIR/encryption-private-key.pem`.                                                    |
| `DATA_DIR`                   |                                             | unset                                                                   | `/data` (set by the Docker image)                                        | Writable directory where generated secrets are persisted, so a container comes back with the same keys across restarts.                                                                                                                                                                                                                |
| `NEXT_PUBLIC_SITE_URL`       |                     ✅                      | `http://localhost:3000`                                                 | `https://s3-viewer.example.com`                                          | The web app's origin: CORS, the `Origin` check, trusted origins and email links.                                                                                                                                                                                                                                                       |
| `NEXT_PUBLIC_API_URL`        |                     ✅                      | `http://localhost:5001`                                                 | `https://api.s3-viewer.example.com`                                      | This API's own origin: Better Auth base URL, OAuth callbacks, `Secure` cookies.                                                                                                                                                                                                                                                        |
| `NODE_ENV`                   |                                             | `development`                                                           | `production`                                                             | Also gates whether a cleartext `http://` S3 endpoint is accepted outside of `ALLOW_PRIVATE_ENDPOINTS=true`.                                                                                                                                                                                                                            |
| `EMAIL_TRANSPORT`            |                                             | `smtp` (mailpit) or `none`, whichever the wizard's email question chose | `resend`, `smtp` or `none`                                               | Which mail transport sends auth and invite email. The wizard always writes one of the two explicitly rather than leaving it to inference. Unset ⇒ `resend` if `RESEND_KEY` is set, else `smtp` if `SMTP_URL` is set, else `none`. `none` is intentional and fully supported.                                                           |
| `SMTP_URL`                   |          if `EMAIL_TRANSPORT=smtp`          | `smtp://localhost:1025` (mailpit)                                       | `smtp://user:pass@mail.example.com:587`                                  | SMTP connection string (`smtp://` or `smtps://`). Required in every environment when `EMAIL_TRANSPORT=smtp`; ignored otherwise.                                                                                                                                                                                                        |
| `RESEND_KEY`                 |         if `EMAIL_TRANSPORT=resend`         | unset                                                                   | `re_…`                                                                   | Resend API key. Required when `EMAIL_TRANSPORT=resend`; ignored otherwise.                                                                                                                                                                                                                                                             |
| `EMAIL_FROM`                 | if a transport is configured, in production | unset                                                                   | `S3 Viewer <hello@yourdomain.com>`                                       | Sender for auth and invite email. Required in production when `resend` or `smtp` is configured; there is no default sender, so a self-hosted deploy never sends mail claiming to be from May Inc. Not needed with `EMAIL_TRANSPORT=none`.                                                                                              |
| `SUPPORT_EMAIL`              |                                             | unset                                                                   | `support@yourdomain.com`                                                 | Contact shown to admins who hit the pending-invite cap, and in the account-deletion confirmation email. Unset ⇒ omitted; the email points at GitHub issues instead.                                                                                                                                                                    |
| `GITHUB_CLIENT_ID`           |                                             | unset                                                                   | GitHub OAuth app id                                                      | Set together with the secret, or leave both unset. The only switch for GitHub login.                                                                                                                                                                                                                                                   |
| `GITHUB_CLIENT_SECRET`       |                                             | unset                                                                   | GitHub OAuth app secret                                                  | Set together with the id, or leave both unset.                                                                                                                                                                                                                                                                                         |
| `ALLOW_PRIVATE_ENDPOINTS`    |                                             | unset, or `true` if the wizard's demo-bucket question is yes            | unset                                                                    | Exactly `true` lets S3 endpoints resolve to private, loopback or link-local addresses (a MinIO on your LAN, the local demo bucket) and allows `http://` in production too. Default false, which is the SSRF-safe setting. Logs a loud boot warning when true.                                                                          |
| `PORT`                       |                                             | `5001`                                                                  | `5001`                                                                   | Port the API listens on.                                                                                                                                                                                                                                                                                                               |
| `TRUST_PROXY`                |                                             | `loopback`                                                              | `1` behind a single reverse proxy (`docker-compose.proxy.yml` sets this) | Express `trust proxy`; behind a load balancer use the hop count. See the [warning](#8-production-notes) below before changing this.                                                                                                                                                                                                    |
| `COOKIE_SAMESITE`            |                                             | `lax`                                                                   | `lax`, or `none` on a platform's default hostnames                       | `SameSite` on the session cookie. Set `none` only when the web app and the API are different sites (`*.onrender.com`, `*.fly.dev`, `*.up.railway.app` are public suffixes), or sign-in never sticks; `none` requires an `https://` `NEXT_PUBLIC_API_URL` and is a boot error without one. See [Platform deploys](#5-platform-deploys). |
| `MAX_UPLOAD_BYTES`           |                                             | `5368709120`                                                            | `5368709120`                                                             | Largest upload body in bytes, enforced while streaming so a false `Content-Length` cannot bypass it. Unset ⇒ 5 GiB.                                                                                                                                                                                                                    |
| `UPLOAD_PART_BYTES`          |                                             | `5242880`                                                               | `5242880`                                                                | Multipart part size in bytes. Unset ⇒ 5 MiB. Min 5 MiB, max 5 GiB. A known `Content-Length` raises the part size when needed to stay under S3's 10,000-part cap.                                                                                                                                                                       |
| `MAX_CONCURRENT_UPLOADS`     |                                             | `6`                                                                     | `6`                                                                      | Maximum active uploads per API process; excess requests receive 429 with Retry-After.                                                                                                                                                                                                                                                  |
| `MAX_USER_UPLOADS`           |                                             | `3`                                                                     | `3`                                                                      | Maximum active uploads per user per API process.                                                                                                                                                                                                                                                                                       |
| `UPLOAD_MEMORY_BUDGET_BYTES` |                                             | `268435456`                                                             | `268435456`                                                              | Shared buffer reservation budget (256 MiB). At least four part buffers must fit. Leave headroom for Node, TLS and other requests; this does not cap total process memory.                                                                                                                                                              |
| `UPLOAD_IDLE_TIMEOUT_MS`     |                                             | `120000`                                                                | `120000`                                                                 | Upload inactivity deadline in milliseconds; stalled uploads abort and release capacity after S3 cleanup.                                                                                                                                                                                                                               |
| `LOG_LEVEL`                  |                                             | `debug`                                                                 | `warn`                                                                   | `debug`, `info`, `warn` or `error`. Unset ⇒ `warn` in production, `debug` otherwise.                                                                                                                                                                                                                                                   |

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

| Variable                     | Default                 | What it does                                                                                                                                                              |
| ---------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SITE_URL`                   | `http://localhost:3000` | Public origin of the web app: what people type in the browser.                                                                                                            |
| `API_URL`                    | `http://localhost:5001` | Public origin of the API: must be reachable from the browser, not just from `web`.                                                                                        |
| `POSTGRES_PASSWORD`          | `s3viewer`              | Password for the bundled Postgres container.                                                                                                                              |
| `TRUST_PROXY`                | unset (⇒ `loopback`)    | Passed through to the API; `docker-compose.proxy.yml` makes it `1`. Setting it here overrides both, for a proxy of your own or a second hop.                              |
| `COOKIE_SAMESITE`            | unset (⇒ `lax`)         | Set `none` only when the web app and the API are different sites, which needs an `https://` `API_URL`. See [Platform deploys](#5-platform-deploys).                       |
| `BETTER_AUTH_SECRET`         | unset (⇒ generated)     | Only for migrating an existing install: overrides the secret the API generates into its `/data` volume. Existing sessions survive.                                        |
| `ENCRYPTION_PRIVATE_KEY`     | unset (⇒ generated)     | Only for migrating an existing install: the RSA key that decrypts already-stored S3 credentials. See the one-line PEM note below.                                         |
| `LANDING_ORIGIN`             | unset                   | Origin of the landing container; set it to `http://landing:3001` with the `landing` profile. Leave commented out (not blank) otherwise.                                   |
| `SITE_HOSTNAME`              | unset                   | Hostname Caddy serves the web app on (`proxy` profile).                                                                                                                   |
| `API_HOSTNAME`               | unset                   | Hostname Caddy serves the API on (`proxy` profile).                                                                                                                       |
| `ACME_EMAIL`                 | unset                   | Address Let's Encrypt notifies about expiring certificates (`proxy` profile).                                                                                             |
| `EMAIL_TRANSPORT`            | unset (⇒ inferred)      | `none`, `resend` or `smtp`; see the [`apps/api/.env` table](#appsapienv) above.                                                                                           |
| `RESEND_KEY`                 | unset                   | Resend API key; sending email switches on as soon as this is set.                                                                                                         |
| `SMTP_URL`                   | unset                   | SMTP connection string.                                                                                                                                                   |
| `EMAIL_FROM`                 | unset                   | From address on outgoing email.                                                                                                                                           |
| `SUPPORT_EMAIL`              | unset                   | Contact shown to admins who hit the pending-invite cap.                                                                                                                   |
| `GITHUB_CLIENT_ID`           | unset                   | GitHub OAuth app client id; set both id and secret or neither.                                                                                                            |
| `GITHUB_CLIENT_SECRET`       | unset                   | GitHub OAuth app client secret.                                                                                                                                           |
| `ALLOW_PRIVATE_ENDPOINTS`    | unset                   | `true` allows S3 endpoints on private/loopback addresses (a LAN MinIO).                                                                                                   |
| `MAX_UPLOAD_BYTES`           | unset (⇒ 5 GiB)         | Largest upload body in bytes.                                                                                                                                             |
| `UPLOAD_PART_BYTES`          | unset (⇒ 5 MiB)         | Multipart part size in bytes. Min 5 MiB, max 5 GiB.                                                                                                                       |
| `MAX_CONCURRENT_UPLOADS`     | unset (⇒ `6`)           | Maximum active uploads per API process; excess requests receive 429 with Retry-After.                                                                                     |
| `MAX_USER_UPLOADS`           | unset (⇒ `3`)           | Maximum active uploads per user per API process.                                                                                                                          |
| `UPLOAD_MEMORY_BUDGET_BYTES` | unset (⇒ `268435456`)   | Shared buffer reservation budget (256 MiB). At least four part buffers must fit. Leave headroom for Node, TLS and other requests; this does not cap total process memory. |
| `UPLOAD_IDLE_TIMEOUT_MS`     | unset (⇒ `120000`)      | Upload inactivity deadline in milliseconds; stalled uploads abort and release capacity after S3 cleanup.                                                                  |
| `LOG_LEVEL`                  | unset (⇒ `warn`)        | `debug`, `info`, `warn` or `error`.                                                                                                                                       |

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

## 8. Production notes

- **Provider compatibility.** Browsing, previews, downloads and app-managed
  team access use S3 APIs across providers. AWS S3, Cloudflare R2 and MinIO
  support conditional new-file uploads, including multipart. Replacements
  are R2-only; object deletion supports AWS and R2; rename is unavailable everywhere.
  B2 uploads remain blocked pending verified conditional-write support.
  The UI explains these restrictions and combines capability flags with
  team permissions before enabling actions.
  See [provider compatibility](./PROVIDER-COMPATIBILITY.md) for the researched
  protocol differences, permissions, and test coverage.

- **Destructive operations.** AWS object deletion requires reviewed ETags;
  R2 checks each reviewed ETag and then performs ordinary key deletion. Pause
  other writers: an R2 object changed after the check can still be deleted.
  Uncertain outcomes and conflicts require refresh and review. Rename and
  AWS/compatible-endpoint replacements stop before storage requests because
  copy/delete and metadata reads cannot atomically preserve concurrent ACL
  or tag-based permission changes. R2 replacements preserve readable metadata
  and send conditional writes without unsupported ACL/tag requests. Use your
  provider's recovery features where available; unversioned AWS deletion may
  be permanent.

- **Multiple API workers.** Each S3 client lookup checks the current encrypted
  credentials and provider in PostgreSQL, including cache hits. Database
  failures refuse storage access. Operations that already obtained a client
  may finish during rotation. Regional clients are invalidated with their base
  credentials. Auth session cookie caching is disabled, and sessions expire
  after an absolute 90 days across API and authentication endpoints. Deploy
  API and web together: API contract version 4 adds account-deletion identity
  binding and storage capability flags; object mutation paths remain `/v3`.
  Legacy clients must refresh before mutations.

- **Creating buckets.** Existing buckets are never attached by reissuing
  CreateBucket; that can reset ACLs in AWS us-east-1. Duplicate app requests
  are serialized across replicas with a bounded PostgreSQL transaction (up
  to 65 seconds per active creation). External console/CLI provisioning does
  not participate in this lock. If credentials or permissions change during
  creation, the new storage bucket is retained without granting fresh access;
  an owner can inspect it at the provider. No automatic bucket deletion runs.

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

## 9. Updating

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
  [capability matrix](#6-capability-matrix)).
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
