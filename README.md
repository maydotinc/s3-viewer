# s3 viewer

an open-source file explorer for S3-compatible storage. browse, edit, move,
and share files across AWS S3, Cloudflare R2, MinIO, or your own bucket,
without handing anyone your keys.

built and maintained by [May Inc.](https://may.inc)

<img src="./apps/landing/public/landing/bucketview.png" alt="s3 viewer showing a bucket with folders, files and the row actions menu" width="100%">

## 💙 some features we're proud of

- **edit files in place.** open a text file, change it, hit Cmd/Ctrl+S. Markdown
  renders as a document, JSON as a collapsible tree. saves are ETag-checked, so
  you never overwrite someone else's change.
- **bulk everything.** multi-select to move, delete, or zip. bulk rename with
  find and replace, prefix, suffix, extension, or lowercase, previewed first.
- **copy between providers.** R2 to S3, S3 to MinIO, any direction. skip or
  replace what's already there, resume if it stops.
- **edit metadata without the console.** content type, Cache-Control,
  Content-Disposition, Expires, and custom metadata from one modal.
- **share a folder, not the bucket.** limit a viewer or editor to `landing/`.
  s3 viewer enforces it, so it works on every provider with no IAM policy.
- **every S3 in one sidebar.** AWS S3, Cloudflare R2, Backblaze B2, MinIO, or
  a bucket on your own hardware. credentials are encrypted in the browser and
  members never see them.
- **the rest.** resumable uploads, folder upload by drag and drop, incomplete
  multipart cleanup, a Cmd/Ctrl+K palette, device sessions, and an optional
  tamper-evident activity log with CSV export.

some features depend on your provider and permissions. the
[compatibility table](./PROVIDER-COMPATIBILITY.md) covers the details, including
the app's 5 GiB limit on R2 server-side copy, move, rename, and metadata updates.

## 🚀 getting started

you'll need Docker with Compose 2.20 or newer. then:

```bash
git clone https://github.com/maydotinc/s3-viewer
cd s3-viewer
docker compose up -d
```

open [localhost:3000](http://localhost:3000). the first run builds the apps,
starts Postgres, generates your keys, and sets up the database. no `.env` needed.
`docker compose ps` shows when everything is ready.

sign up in the app. email is off by default, so the app tells you the account
has to be verified by whoever runs the instance. that's you, from the terminal:
[verify an account without email](./SELF-HOSTING.md#verify-an-account-without-email).

log in, connect your storage, and you're in.

for your own domain, email, or a different host, see the
[self-hosting guide](./SELF-HOSTING.md).

## 🔐 accounts and data

email and password sign-in works out of the box. GitHub login is optional.
add SMTP or Resend for verification codes, password resets, and team invites.
anyone can sign up by default. to limit sign-ups to invited people or your email
domains, or close them, set `SIGNUP_MODE` in `.env` (see
[sign-up policy](./SELF-HOSTING.md#sign-up-policy)).

your storage credentials are encrypted in the browser and saved as ciphertext
in Postgres. the API decrypts them in memory to talk to your provider, so use an instance
you trust. uploads go through the API; individual downloads use short-lived
presigned URLs. no bucket CORS setup needed.

owners can access every connected bucket. everyone else needs access to each
bucket they use. on a server limited to specific buckets, **remove bucket**
takes one off the list for every member; the bucket and its files stay in
storage. deleting files does delete them from storage.

a viewer or editor can be limited to folders, like `landing/` in a shared
bucket. inside those folders they keep their role's abilities and can't open,
list, or copy anything else in the bucket. admins always get whole
buckets. s3 viewer enforces this, not your provider: members never hold your
storage credentials, but those credentials still reach the whole bucket. a
download link someone already opened keeps working for up to 15 minutes after
their access changes.

activity logging is off by default and only records what happens through
s3 viewer. please report security issues through [SECURITY.md](./SECURITY.md).

## 🛠️ local development

you'll need Node 22.12+ (`.nvmrc` selects Node 22) and the pnpm version pinned in `packageManager` in `package.json`. after cloning:

```bash
# if you don't have pnpm yet, corepack installs the pinned version
corepack enable

pnpm install --frozen-lockfile
pnpm dev
```

the first run asks which services you want. press Enter for Postgres and a local
email inbox in Docker. a demo RustFS bucket and the marketing site are optional.
then open [localhost:3000](http://localhost:3000). verification emails land at
[localhost:8025](http://localhost:8025).

`pnpm run setup` opens the wizard again (`--help` lists its options). with your
own Postgres you can skip Docker:

```bash
DATABASE_URL='postgresql://user:pass@localhost:5432/s3viewer' pnpm run setup --no-docker --yes
pnpm dev
```

the demo bucket uses endpoint `http://localhost:9000`, bucket `demo`, and
`rustfsadmin` for both keys; the wizard allows private endpoints for it.
`pnpm stop` stops the dev apps and containers and keeps your data. the database
helpers `pnpm db:deploy`, `pnpm db:migrate`, `pnpm db:generate`, and
`pnpm db:status` load `apps/api/.env` automatically.

| path                                                     | what's inside                       |
| -------------------------------------------------------- | ----------------------------------- |
| `apps/web`                                               | Next.js app                         |
| `apps/api`                                               | Express API                         |
| `apps/landing`                                           | optional Next.js marketing site     |
| `packages/db`                                            | Prisma schema and migrations        |
| `packages/auth`                                          | Better Auth integration             |
| `packages/email`                                         | email transports and templates      |
| `packages/permissions`, `packages/shared`, `packages/ui` | shared permissions, schemas, and UI |

## 🤝 contributing

bugs, ideas, and PRs are welcome.
keep shared request schemas and permission rules in the workspace packages.
before opening a PR, run:

```bash
pnpm db:generate
pnpm format:check
pnpm lint
pnpm check-types
pnpm test
NEXT_PUBLIC_SITE_URL=http://localhost:3000 pnpm build
```

`pnpm format` fixes formatting. Docker and provider integration checks are in
[release validation](./RELEASE-VALIDATION.md).

for visual changes, `pnpm favicons` rebuilds icons from the landing logo.
`pnpm landing:assets` optimizes landing images and refreshes their placeholders.

## 📄 license

[MIT](./LICENSE) © May Inc. the license covers the code only. the May and
S3 Viewer names and logos are not part of it, and bundled third-party icons and
the Inter font carry their own terms; both are listed in [NOTICE.md](./NOTICE.md).

**if s3 viewer is useful to you, [give it a star ⭐](https://github.com/maydotinc/s3-viewer)
and [follow May on GitHub](https://github.com/maydotinc) for what we build next.**
