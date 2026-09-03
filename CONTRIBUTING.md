# Contributing to S3 Viewer

Thanks for helping out! This is a pnpm + Turborepo monorepo.

## Setup

```bash
git clone https://github.com/maydotinc/s3-viewer
cd s3-viewer
pnpm install
pnpm bootstrap                              # local HTTPS dev URLs via portless
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/landing/.env.example apps/landing/.env
pnpm --filter @s3-viewer/db db:deploy       # apply migrations
pnpm dev
```

Node 20 or newer is required (`.nvmrc` pins 20). See the [README](./README.md) for
the full setup, including generating the RSA key pair.

## Branch and PR flow

1. Branch off `main`: `git checkout -b feat/short-description`.
2. Keep the change focused — one concern per pull request.
3. Push and open a PR against `main` with a clear description and screenshots for
   UI changes. Link the issue it closes.
4. A maintainer reviews; squash-merge is the default.

## Before opening a PR

```bash
pnpm lint && pnpm check-types && pnpm test
```

Run `pnpm format` to apply Prettier (`pnpm format:check` runs in CI).

## Commit style

Conventional Commits, e.g.:

```
feat(web): add bucket search
fix(api): reject expired invitations
chore(deps): bump better-auth
docs: clarify TRUST_PROXY
```

Common types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`.

## Database changes

Schema authors run `pnpm --filter @s3-viewer/db db:migrate` (`prisma migrate dev`)
and commit the generated migration. Everyone else applies migrations with
`pnpm --filter @s3-viewer/db db:deploy`.

## Reporting problems

Bugs and feature requests go in GitHub Issues. Security issues go to
[info@may.inc](mailto:info@may.inc?subject=S3%20Viewer%20security) with "S3 Viewer"
in the subject line — see [SECURITY.md](./SECURITY.md).
