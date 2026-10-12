# s3 viewer 🪣

a simple, open-source file explorer for S3. browse your buckets, move files,
and share access with your team.

built and maintained by [May Inc.](https://may.inc).

<img src="./apps/landing/public/landing/bucketview.png" alt="s3 viewer showing a bucket with folders, files and the row actions menu" width="100%">

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

sign up in the app. email is off by default, so verify your account from the
terminal before connecting your first bucket:

```bash
# use the email you signed up with
docker compose exec api node dist/verify-email.js you@example.com

# check the account details, then add the printed account ID
docker compose exec api node dist/verify-email.js you@example.com ACCOUNT_ID
```

sign in again, connect your storage, and you're in.

for your own domain, email, or a different host, see the
[self-hosting guide](./SELF-HOSTING.md).

## 📝 features

- [x] connect multiple AWS S3, Cloudflare R2, Backblaze B2, or other S3-compatible servers
- [x] browse and preview files, upload with progress and resume, download folders as zip
- [x] copy, move, rename, and delete files, including transfers between servers
- [x] edit small text files, content types, cache headers, and custom metadata
- [x] find and clean up incomplete multipart uploads
- [x] share specific buckets with viewers, editors, and admins
- [x] limit a viewer or editor to specific folders inside a bucket
- [x] optional activity logs with CSV export and integrity checks

some features depend on your provider and permissions. the
[compatibility table](./PROVIDER-COMPATIBILITY.md) covers the details, including
the app's 5 GiB limit on R2 server-side copy, move, rename, and metadata updates.

## 🔐 accounts and data

email and password sign-in works out of the box. GitHub login is optional.
add SMTP or Resend for verification emails, password resets, and team invites.
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

you'll need Node 22.12+ (`.nvmrc` selects Node 22) and pnpm 10.28.2. after cloning:

```bash
# if you don't have pnpm yet
npm install -g pnpm@10.28.2

pnpm install --frozen-lockfile
pnpm dev
```

the first run asks which services you want. press Enter for Postgres and a local
email inbox in Docker. a demo RustFS bucket and the marketing site are optional.
then open [localhost:3000](http://localhost:3000). verification emails land at
[localhost:8025](http://localhost:8025).

you can use your own Postgres connection string in the wizard too.
`pnpm run setup` opens setup again (`--help` lists its options); `pnpm stop` stops
the dev apps and containers.

| path                                                    | what's inside                       |
| ------------------------------------------------------- | ----------------------------------- |
| `apps/web`                                              | Next.js app                         |
| `apps/api`                                              | Express API                         |
| `apps/landing`                                          | optional Next.js marketing site     |
| `packages/db`                                           | Prisma schema and migrations        |
| `packages/auth`                                         | Better Auth integration             |
| `packages/email`                                        | email transports and templates      |
| `packages/permissions`, `packages/types`, `packages/ui` | shared permissions, schemas, and UI |

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

[MIT](./LICENSE) © May Inc. bundled third-party icons and the Inter font are
listed in [NOTICE.md](./NOTICE.md).

**if s3 viewer is useful to you, [give it a star ⭐](https://github.com/maydotinc/s3-viewer)
and [follow May on GitHub](https://github.com/maydotinc) for what we build next.**
