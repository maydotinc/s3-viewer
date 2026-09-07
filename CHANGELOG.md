# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Added

- Sign-up policy: `SIGNUP_MODE` (`open` | `domains` | `invite` | `closed`, default `open`) lets an
  operator close public sign-up, restrict it to an allowlist of email domains
  (`ALLOWED_EMAIL_DOMAINS`), or restrict it to addresses holding a pending invitation. `domains`
  also always admits an invited address regardless of domain, since an invitation otherwise
  couldn't be accepted; `closed` admits nobody, invited or not. Refused attempts are recorded in
  the audit log.
- Audit log: security-relevant actions (sign-in, sign-up, password changes, session revocation,
  member/invite/role changes, and more) are recorded. Anyone with permission to manage a server's
  members can read its trail at `GET /servers/:serverId/audit`, with a matching "Activity" tab in
  the Share dialog; everyone can read their own account-level history (sign-ins, password changes,
  session revocations) at `GET /account/audit`, surfaced as a new "Security activity" card on the
  profile page. Retention is controlled by `AUDIT_RETENTION_DAYS` (default `0`, keep forever),
  pruned in batches so turning it on against an old backlog doesn't hold a long lock.
- Sessions card on the profile page: lists every signed-in session with device/expiry info, the
  current session flagged, a per-session "Sign out", and "Sign out everywhere else".
- Password is now required to delete an account, closing the gap where a stolen, still-logged-in
  session could delete the account outright. Accounts with no password set are guided to set one
  first.
- Shared, cross-replica rate limiting: `RATE_LIMIT_STORE=postgres` moves the security-relevant
  limiters (sign-in, sign-up, connect, invites, the `exists` check) into the database so they are
  enforced consistently when more than one API instance is running. The default, `memory`, is
  unchanged and is what a single-instance deployment should keep using.
- Per-server upstream request budget: each connected S3-compatible server is now capped at
  `S3_REQUESTS_PER_MINUTE` (default `12000`) outbound requests per API process per minute, so one
  runaway or misbehaving server cannot starve the others.
- `RUN_MIGRATIONS` (default `true`) lets an operator skip `prisma migrate deploy` on container
  boot, for running more than one API replica without a migration race, or for running migrations
  out of band.
- Docker images can now be pinned to a released version with `S3_VIEWER_VERSION` (compose reads
  `ghcr.io/maydotinc/s3-viewer-{api,web}:${S3_VIEWER_VERSION:-latest}`), instead of always
  tracking `latest`.
- Dependabot now also watches the three app Dockerfiles and the base images pinned in
  `docker-compose.yml` (weekly, grouped minor/patch).

### Changed

- Content-Security-Policy: script execution on the web app's own pages, in production, now
  requires a per-request nonce (`script-src 'self' 'nonce-…' 'strict-dynamic'`) instead of
  `'unsafe-inline'`. Marketing pages proxied from the landing site keep `'unsafe-inline'` for now,
  since nothing on the web app's side can stamp a nonce onto markup another Next app rendered.
- The landing-page proxy routes strip `Cookie` and `Authorization` before forwarding, so a
  same-origin request for a marketing page can no longer leak session credentials to the landing
  service.
- A GitHub sign-in is verified when GitHub itself reports the address verified, and not otherwise —
  previously every GitHub sign-in was treated as verified regardless of GitHub's own flag, which
  also weakened account-linking protection for that provider.
- Account linking now enforces `requireLocalEmailVerified` for every provider (no
  `trustedProviders`), closing a pre-account-takeover window.
- Keys containing `.`, `..`, or empty (`//`) path segments — legal on S3, normally eaten by the
  browser/Next.js router — now round-trip correctly through folder and object links. A key that is
  itself a folder-marker object (ending in `/`) now keeps its own URL (`?key=…&view=object`)
  instead of collapsing onto the same-named folder's link.
- The web and landing apps no longer fetch Inter from fonts.googleapis.com at build or run time;
  the font is vendored and self-hosted, so a build behind a firewall no longer needs that
  network access.
- Folder deletes resume instead of losing progress: a failed batch stops and shows a summary
  ("Deleted N; M failed; more remain") with a "Continue deleting" action, and the tab warns before
  closing mid-delete. A batch failure always reports "more remain", even on what would have been
  the last page, since that batch's objects are confirmed still there; "Continue deleting" stays
  disabled only when nothing another attempt could change is left.
- Uploading onto existing keys now offers "Replace all", "Skip existing", or "Cancel", instead of
  only replace-or-cancel.
- The keep-alive and headers timeouts on the API's HTTP server are now explicit
  (`KEEP_ALIVE_TIMEOUT_MS`, default `65000`) instead of Node's defaults, and the outbound S3 HTTP
  agent's socket limits are configurable (`S3_MAX_SOCKETS_PER_HOST`, `S3_MAX_TOTAL_SOCKETS`).

### Security

- Object keys and prefixes are no longer written to server logs in full; log lines carry a
  truncated hash and length instead.
- Verification identifiers (email verification / password reset tokens) are now stored hashed.
  **Reset and verification links issued before this upgrade stop working** — anyone with one
  pending should request a new one after upgrading.
- `POST …/objects/exists` now requires upload permission and is rate-limited per user; previously
  any viewer could call it.
