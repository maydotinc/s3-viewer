# self-hosting s3 viewer

the app, API, and Postgres in one Docker Compose command. email, GitHub login, and the landing site are optional.

## quick start

you'll need Docker with Compose 2.20 or newer. then run:

```bash
git clone https://github.com/maydotinc/s3-viewer.git
cd s3-viewer
docker compose up -d
```

open [localhost:3000](http://localhost:3000) once the first build finishes. no `.env` needed — the API runs migrations and saves generated secrets in its `/data` volume. the app and API are only reachable from your machine by default.

create an account. nobody gets in before their email is verified, and email is off by default, so the app asks you to [verify the account below](#verify-an-account-without-email) from the terminal.

### verify an account without email

look up the account you just created:

```bash
docker compose exec api node dist/verify-email.js you@example.com
```

make sure it's your account, or check with the owner outside the app. then run it again with the account ID it prints:

```bash
docker compose exec api node dist/verify-email.js you@example.com ACCOUNT_ID
```

then log in. from source, use `pnpm account:verify you@example.com [ACCOUNT_ID]`. on another Docker host, run `node dist/verify-email.js` with the same arguments in the API container.

## reverse proxy / Caddy

to put it online, point two DNS names at your server and open inbound ports 80 and 443. copy the example config:

```bash
cp .env.example .env
```

set these values in the root `.env`:

```dotenv
SITE_URL=https://s3.example.com
API_URL=https://api.s3.example.com
SITE_HOSTNAME=s3.example.com
API_HOSTNAME=api.s3.example.com
```

on a fresh install, replace `POSTGRES_PASSWORD` with a long, random, URL-safe password too. start everything with Caddy:

```bash
docker compose -f docker-compose.yml -f docker-compose.proxy.yml --profile proxy up -d
```

Caddy handles HTTPS. keep the second Compose file in later commands — it sets `TRUST_PROXY=1` so rate limits see each visitor's IP. for your own proxy, route to `web:3000` and `api:5001`, set `TRUST_PROXY` for the actual trusted hops, and have the proxy replace client-supplied forwarding headers.

copies, renames, moves and header edits run inside storage, so the API sends nothing until they finish — up to about two minutes per GiB of an object, and a bulk or folder move stays quiet for its whole batch. a copy between two servers streams through the API and stays quiet for as long as the object takes at your network speed. a proxy that closes quiet connections sooner (nginx's `proxy_read_timeout` defaults to 60 seconds) will fail the long ones, so raise its read or idle timeout on the API route. Cloudflare's proxy cuts a quiet connection at 100 seconds and only Enterprise plans can raise that, so point the API hostname at your server in DNS-only mode. the bundled Caddy config has no such limit.

both public URLs need to work in the browser. two subdomains of the same domain are easiest. if the app and API are on different sites, set `COOKIE_SAMESITE=none` on the API and use HTTPS; browser third-party-cookie settings can still get in the way.

## email

add email for verification codes, password resets, and team invites. for SMTP, add this to the root `.env`:

```dotenv
EMAIL_TRANSPORT=smtp
SMTP_URL=smtp://user:pass@mail.example.com:587
EMAIL_FROM="S3 Viewer <hello@example.com>"
```

for Resend, set `EMAIL_TRANSPORT=resend`, `RESEND_KEY`, and `EMAIL_FROM` instead. run your Compose command again to apply changes. `apps/api/.env.example` documents each email variable, including the SMTP URL forms.

with `none`, password sign-in still works once an account is verified. use the command above to verify accounts; emailed recovery and invites stay off. in development, unsent messages appear in the API log. check that log too if your email provider isn't delivering.

## sign-up policy

set `SIGNUP_MODE` in your API environment:

| mode             | who can create an account                                                   |
| ---------------- | --------------------------------------------------------------------------- |
| `open` (default) | anyone                                                                      |
| `domains`        | addresses in `ALLOWED_EMAIL_DOMAINS`, plus addresses with a live invitation |
| `invite`         | addresses with a live invitation                                            |
| `closed`         | nobody, even with an invite. existing accounts can still sign in            |

`ALLOWED_EMAIL_DOMAINS=example.com,example.org` turns on `domains` mode unless you set a mode explicitly. create your first account before switching to `invite` or `closed`.

## GitHub login

set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` together on the API and the login button appears automatically. use this callback URL for your OAuth app:

```text
https://api.s3.example.com/auth/callback/github
```

for local development, use `http://localhost:5001/auth/callback/github`. the app uses GitHub's email verification status. to link an existing password account, that account's email needs to be verified too.

## private storage endpoints

to connect to storage on your LAN, set `ALLOW_PRIVATE_ENDPOINTS=true` on the API. this allows private addresses and HTTP endpoints, so only turn it on for an instance you trust. otherwise, private and loopback addresses are blocked and production endpoints need HTTPS.

the API container needs to reach the endpoint. `localhost` inside Docker points to that container, not your host machine.

## optional landing site

the app opens the dashboard by default. to add the landing site, set `LANDING_ORIGIN=http://landing:3001` in the root `.env`, then add `--profile landing` to your Compose command:

```bash
docker compose --profile landing up -d
```

the web app serves its pages and assets through a proxy, so you don't need another public hostname. after changing `SITE_URL`, rebuild the landing image with `docker compose --profile landing up -d --build` — its metadata is set at build time.

## configuration

all the settings live in the example files:

| running with    | where to configure it                                                |
| --------------- | -------------------------------------------------------------------- |
| Docker Compose  | root [`.env.example`](./.env.example) → `.env`                       |
| API from source | [`apps/api/.env.example`](./apps/api/.env.example) → `apps/api/.env` |
| web from source | [`apps/web/.env.example`](./apps/web/.env.example) → `apps/web/.env` |

Compose maps `SITE_URL` and `API_URL` to `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_API_URL` on both services. outside Compose, set those two full public origins on both services yourself. the web app reads them at runtime.

the API needs `DATABASE_URL` and secrets that survive restarts. the Docker image uses `DATA_DIR=/data`; mount a writable volume there. without `DATA_DIR`, set `BETTER_AUTH_SECRET` and `ENCRYPTION_PRIVATE_KEY` yourself. the development wizard generates them for you.

the Docker image sets `UV_THREADPOOL_SIZE=16` so hostname lookups cannot starve crypto and zlib; when running the API from source, export it before starting Node.

audit logging is off until a server owner turns it on; a server's own retention, when set, replaces `AUDIT_RETENTION_DAYS`. no retention can go below `AUDIT_RETENTION_MIN_DAYS` (default 90), and a deleted server's log is kept that long.

## other platforms

build both Dockerfiles from the **repo root**, with the whole monorepo as build context:

| service | Dockerfile            | port   | health check  |
| ------- | --------------------- | ------ | ------------- |
| API     | `apps/api/Dockerfile` | `5001` | `/health`     |
| web     | `apps/web/Dockerfile` | `3000` | `/api/health` |

you'll need Postgres, both public URLs, a persistent API `/data` volume, and HTTPS. set `TRUST_PROXY` for the platform's proxy. the API container runs migrations on startup. it runs as uid 1000, so `/data` must be writable by that user; if the platform starts the container as root, the entrypoint takes ownership of `/data` and drops to uid 1000 itself. start with one API instance.

### Render

use [`render.yaml`](./render.yaml) as a Blueprint. it sets up both services, Postgres, and an API disk. set `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_API_URL` to the actual public origins on **both** services, and update them if your names or domains change. the template sets `EMAIL_TRANSPORT=none`, so change it when adding email.

### Fly.io

use [`deploy/fly/api.toml`](./deploy/fly/api.toml) and [`deploy/fly/web.toml`](./deploy/fly/web.toml). edit the app names, region, and public URLs. create both apps, attach Postgres to the API as `DATABASE_URL`, and create its `s3_viewer_data` volume in the same region. deploy from the repo root:

```bash
fly deploy -c deploy/fly/api.toml --dockerfile apps/api/Dockerfile --ha=false
fly deploy -c deploy/fly/web.toml --dockerfile apps/web/Dockerfile
```

the API template expects its volume at `/data`. keep credentials in Fly secrets. change the template's `EMAIL_TRANSPORT=none` when adding email.

for Railway or another container platform, use the settings above. for a Compose host like Coolify or Portainer, start with [`docker-compose.yml`](./docker-compose.yml) and set up its public routing. only turn on the bundled Caddy profile if you're using it as your reverse proxy.

## development

you'll need Node 22.12+ and the pnpm version pinned in `package.json`:

```bash
pnpm install
pnpm dev
```

on first run, the setup wizard generates secrets, writes your app `.env` files, starts Postgres and a local Mailpit inbox in Docker, and runs migrations. just press Enter for the defaults. the demo bucket and landing site are optional. open the app at [localhost:3000](http://localhost:3000) and your email inbox at [localhost:8025](http://localhost:8025).

run `pnpm run setup` for the wizard on its own. with your own database, you can skip Docker:

```bash
DATABASE_URL='postgresql://user:pass@localhost:5432/s3viewer' pnpm run setup --no-docker --yes
pnpm dev
```

the optional demo uses endpoint `http://localhost:9000`, bucket `demo`, and `rustfsadmin` for both keys. it's for local development only. the wizard turns on private endpoints for it.

`pnpm stop` stops the development apps and containers and keeps your data. database helpers: `pnpm db:deploy`, `pnpm db:migrate`, `pnpm db:generate`, and `pnpm db:status`. they load `apps/api/.env` automatically.

## operations

- **back up Postgres and the API's `/data` volume together.** the volume holds `auth-secret`, `encryption-private-key.pem`, and, on a fresh Docker install, `audit-chain-key`. lose the encryption key and saved storage credentials become unreadable. lose the audit key and you can't verify past audit rows. the API won't start with keys that don't match the database, so restore both together. back up secrets from environment variables too.
- **update both services together.** after updating your checkout, run `docker compose up -d --build` with your usual overlay and profiles. migrations run automatically. back up first, and test your restore process.
- **finish a rolling update before limiting anyone to folders.** an API replica still on an older version doesn't know about folder limits and treats those grants as whole-bucket access. with one API container this never comes up.
- **before rolling back past folder limits, remove them.** a version from before folder access reads every grant as the whole bucket. to fail closed, delete the limited grants first: `DELETE FROM "bucket_access" WHERE "restrictedFolders"; DELETE FROM "invitation_bucket_access" WHERE "restrictedFolders";` then re-invite those people after you upgrade again.
- **large uploads in progress during an update may need restarting.** multipart upload ids are now tied to the server, bucket, and key they were started for, so an upload begun on a version before that can be cancelled but not continued. anything left behind shows up under **Incomplete uploads**.
- **check startup:** `docker compose ps` and `docker compose logs --tail=100 api web`. the web health check checks the web process, not storage access.
- **keep the volumes.** `docker compose down` keeps them; adding `--volumes` deletes their data. changing `POSTGRES_PASSWORD` after database setup doesn't change the database user's existing password.
- **before scaling:** share one `/data` volume across API replicas, or give them all the same `BETTER_AUTH_SECRET` and `ENCRYPTION_PRIVATE_KEY`. on a fresh install, also copy `/data/audit-chain-key` into `AUDIT_CHAIN_KEY`; an install that had audit history before that key existed derives it from `BETTER_AUTH_SECRET`, so leave `AUDIT_CHAIN_KEY` unset there. keep `RATE_LIMIT_STORE=postgres`, and set `RUN_MIGRATIONS=false` on all but one API replica. budget database connections across all processes. high-volume rate limits and transfer limits stay per process.

### archive ticket limits

zip download tickets live in Postgres, work across API replicas, and expire after five minutes. each ticket can start only one download and needs the same user's active session, current download permission, and current folder access. each user can have five pending tickets. once you have five, a new one replaces the oldest. if a ticket expires, gets replaced, or its download fails after starting, select the files again.

storage behavior varies by provider, especially when edits and deletes happen at the same time. check [provider compatibility](./PROVIDER-COMPATIBILITY.md) before relying on those protections.

running s3 viewer? [star the repo ⭐](https://github.com/maydotinc/s3-viewer) and [follow May on GitHub](https://github.com/maydotinc) to hear about new releases.
