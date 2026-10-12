# Distribution validation

Run this check before tagging a release:

```sh
pnpm install --frozen-lockfile
pnpm --filter @s3-viewer/db db:generate
pnpm test:distribution
```

It requires Docker with Compose and permission to connect to local published
ports. The runner uses `docker-compose.smoke.yml`, a randomly named project,
empty PostgreSQL/API volumes, and random loopback ports. It ignores the root
`.env`; credentials in the smoke file belong only to this disposable stack.
Its `finally` block removes its containers, volumes, network, and image tags,
including after a failed assertion. Docker's build cache remains available.

The `distribution` job of the CI workflow (`.github/workflows/ci.yml`) runs
this check on main/tag pushes and manual dispatches. Packaging PRs can run the
command locally before merge; ordinary PR checks do not require Docker or cloud
credentials.

## What it checks

- Both production Dockerfiles build, including API dependency pruning and the
  web standalone output.
- API startup applies all checked-in migrations to an empty PostgreSQL 16
  database; the packaged Prisma CLI reports the schema up to date.
- API `/health` and `/config`, web `/api/health`, and the rendered `/login` page
  respond successfully.
- Four independent Node processes make 128 rate-limit increments on one key.
  Every count from 1 through 128 occurs once, and an expired window resets.
- Four independent audit writers wait on an externally held PostgreSQL advisory
  lock, then append 96 unique entries. Sequence numbers, every HMAC/link, the
  stored head, and the application's chain verifier must agree. No database or
  scheduler mocks participate in these checks.
- The existing provider integration suite runs against disposable RustFS buckets,
  including uploads, replacement conflicts, an intervening multipart write,
  metadata, rename, archives, listings, presigned downloads, and cleanup.
- PostgreSQL, API, and web restart with their volumes retained. Endpoints still
  work, the public encryption key and all three stored secret fingerprints are
  unchanged, old auth/audit HMAC challenges still verify, and old RSA ciphertext
  still decrypts. This checks key continuity, not every authentication flow.

The PostgreSQL integration tests (`apps/api/lib/testing/*.integration.test.ts`) are
skipped by a plain `pnpm test`. The CI `verify` job runs them on every PR by
creating and migrating an `s3viewer_smoke` database on its Postgres service and
setting `DATABASE_INTEGRATION_URL`. To run them locally against an already
migrated disposable database, set `DATABASE_INTEGRATION_URL` the same way. They
refuse any database whose name is not `s3viewer_smoke` and remove only their own
randomly named rows.

## Provider limits

RustFS results establish behavior for the tested compatible endpoint only. They
do not establish AWS S3, Cloudflare R2, or Backblaze B2 behavior. In particular,
R2 conditional multipart completion has not been independently verified by this
local check. The integration suite's provider-specific intervening-write
assertion runs only when pointed at that provider. Keep cloud atomicity claims
qualified until that case passes against the actual deployment.

Fallback absent-key checks reduce the interval between checking and publishing;
they do not make an endpoint's writes atomic. A passing RustFS suite cannot
eliminate that race or establish that every compatible endpoint enforces
conditional headers. See [provider compatibility](./PROVIDER-COMPATIBILITY.md).
