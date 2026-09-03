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
pnpm --filter @s3-viewer/db db:deploy
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

## Conventions

- **Icons**: [`lucide-react`](https://lucide.dev) for all UI icons (`apps/web`,
  `packages/ui`). [`react-icons`](https://react-icons.github.io/react-icons) is
  only for third-party brand marks (e.g. `FaGithub`, `FaLinkedinIn`) in
  `apps/landing` — don't reach for it for anything else.
- **Dependency versions**: shared versions live in the pnpm `catalog:` in
  [`pnpm-workspace.yaml`](./pnpm-workspace.yaml). Edit the version there, not
  in a package's `package.json` — packages reference it with
  `"<dep>": "catalog:"`.
- **Test coverage**: there is no coverage tooling wired up yet
  (`@vitest/coverage-v8` is not installed, so `vitest --coverage` will fail).
  Once it's added, run it with `pnpm test -- --coverage`.
- **Landing image assets**: `pnpm landing:assets` (`scripts/optimize-landing-assets.ts`)
  recompresses the raster images and Lottie file under `apps/landing/public/landing`
  and regenerates `apps/landing/components/Landing/image-placeholders.ts`, the blur
  placeholders `next/image` uses for those assets. Re-run it after adding or
  replacing any image in that directory — a missing placeholder degrades to
  `placeholder="empty"` (see `apps/landing/lib/blur-placeholder.ts`) rather than
  breaking the page, but the new image will render unblurred until you do. Known
  wrinkle: the script resolves `sharp` by hand out of `node_modules/.pnpm` because
  it isn't a declared dependency anywhere it runs from — it fails with a clear
  error if `pnpm install` hasn't hoisted it.

## Upgrading

- `packages/db/prisma/migrations/20260903000000_account_provider_account_unique`
  deletes duplicate `account` rows before adding a unique constraint (kept rows
  preserved in `account_dedupe_backup` for recovery). Dry-run the dedupe with a
  `SELECT` before applying it in production: a duplicate spanning two different
  users deletes the newer user's OAuth sign-in link, so know ahead of time
  whether any of your rows would be affected.

## Reporting problems

Bugs and feature requests go in GitHub Issues. Security issues go to
[info@may.inc](mailto:info@may.inc?subject=S3%20Viewer%20security) with "S3 Viewer"
in the subject line — see [SECURITY.md](./SECURITY.md).
