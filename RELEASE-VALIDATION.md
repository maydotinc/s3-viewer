# release validation

run this before tagging a release:

```sh
pnpm install --frozen-lockfile
pnpm --filter @s3-viewer/db db:generate
pnpm test:distribution
```

it needs Docker with Compose and permission to connect to local published
ports. the runner uses `docker-compose.smoke.yml` with a randomly named project,
empty Postgres and API volumes, and random loopback ports. it ignores the root
`.env`; the credentials in the smoke file belong only to this disposable stack.
its `finally` block removes the containers, volumes, network, and image tags,
including after a failed assertion or an interrupt (Ctrl-C or SIGTERM). Docker's
build cache stays.

the `distribution` job in [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)
runs the same check on every push, pull request, and manual dispatch, so packaging
changes are validated before merge. it needs Docker but no cloud credentials.

## what it checks

- the API, web, and landing Dockerfiles build, including API dependency pruning
  and the standalone Next outputs.
- API startup applies every checked-in migration to an empty Postgres 16
  database, and the packaged Prisma CLI reports the schema up to date.
- API `/health` and `/config`, web `/api/health`, the rendered `/login` page,
  the landing `/` page, and the landing `/about` page proxied through web all
  respond.
- four independent Node processes make 128 rate-limit increments on one key.
  every count from 1 through 128 occurs once, and an expired window resets.
- four independent audit writers wait on an externally held Postgres advisory
  lock, then append 96 unique entries. sequence numbers, every HMAC and link,
  the stored head, and the app's chain verifier must agree. no database or
  scheduler mocks take part.
- the provider integration suite runs against disposable RustFS buckets:
  uploads, replacement conflicts, an intervening multipart write, metadata,
  rename, archives, listings, presigned downloads, and cleanup.
- Postgres, API, and web restart with their volumes kept. endpoints still work,
  the public encryption key and all three stored secret fingerprints are
  unchanged, old auth and audit HMAC challenges still verify, and old RSA
  ciphertext still decrypts. this checks key continuity, not every
  authentication flow.

the Postgres integration tests (`apps/api/lib/testing/*.integration.test.ts`)
are skipped by a plain `pnpm test`. the CI `verify` job runs them on every PR by
creating and migrating an `s3viewer_smoke` database on its Postgres service and
setting `DATABASE_INTEGRATION_URL`. to run them locally against an already
migrated disposable database, set `DATABASE_INTEGRATION_URL` the same way. they
refuse any database not named `s3viewer_smoke` and remove only their own
randomly named rows.

## provider limits

RustFS results establish behavior for the tested compatible endpoint only. they
say nothing about AWS S3, Cloudflare R2, or Backblaze B2. in particular, R2
conditional multipart completion has not been verified by this local check. the
integration suite's provider-specific intervening-write assertion runs only when
pointed at that provider. keep cloud atomicity claims qualified until that case
passes against the actual deployment.

fallback absent-key checks shrink the window between checking and publishing;
they do not make an endpoint's writes atomic. a passing RustFS suite cannot rule
out that race or prove that every compatible endpoint enforces conditional
headers. see [provider compatibility](./PROVIDER-COMPATIBILITY.md).
