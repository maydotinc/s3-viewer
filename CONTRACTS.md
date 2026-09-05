# Engineering contracts

Read this before touching code. It is the single agreement between the API,
the web app, the landing site and the shared packages. Keep it current.

## Principles

- Minimal and DRY. One way to do each thing. No dead code, no `any`, no
  `console.log` (use `apps/api/lib/logger.ts` on the server; nothing on the client).
- Security first: every route is authenticated and authorized from validated
  input only; never from raw `req.body`/`req.query`.
- Least data: we store only what the product needs (see README "Data we store").
- Product name is "S3 Viewer". Role names come from `ROLE_LABELS` in
  `@s3-viewer/permissions`. Copy is sentence case. A button in flight keeps its
  label and its width: pass `loading` to `Button`, which overlays a centred
  spinner on the still-mounted (but invisible) label. Never swap a label to
  "Saving…".

## Shared values (`@s3-viewer/types`)

- `constants.ts` is the single home for every number or string that more than
  one app relies on: product name, time units, auth code length/TTL, session
  TTL, `SITE_PATHS`, presign expiry, S3 per-request key cap (listing block
  size and delete batch), rename size cap, invite limits, default content type
  and the generic error message. App-only values live in that app's
  `lib/constants.ts`.
- `utils.ts` holds the pure helpers both API and web need: `isFolderKey`,
  `baseName`, `chunk`, `mapLimit`. Wire types for every response body
  (`EstablishResult`, `BucketCheck`, `SendInviteResult`, …) live beside the
  request schemas, and `z.infer` types are exported next to their schema.

## Permissions (`@s3-viewer/permissions`)

- Roles are ordered VIEWER < EDITOR < ADMIN < OWNER and cumulative.
- Server scope = `ServerAccess.role`. Bucket scope = `BucketAccess.role`;
  owners implicitly hold OWNER on every bucket (`effectiveBucketRole`).
- `hasPermission(role, Permission.X)`, `canManageRole(actor, target)`,
  `assignableRoles(actor)`, `ROLE_LABELS`, `ROLE_DESCRIPTIONS`.
- Member management: an actor needs `MANAGE_MEMBERS` and a strictly higher
  rank than BOTH the target's current role and the role being assigned.
  OWNER is never assignable or removable. Owners cannot leave; they delete.
- Server-level permissions: LIST_BUCKETS (all), CREATE_BUCKET (editor+),
  DELETE_BUCKET / RENAME_SERVER / MANAGE_MEMBERS (admin+),
  DELETE_SERVER / UPDATE_CREDENTIALS (owner).
- Object permissions are checked against the effective bucket role.

## API (`apps/api`)

### Conventions

- Error envelope, always: `{ message: string, code?: string }` with a proper
  status (400 validation, 401 unauthenticated, 403 forbidden, 404 not found,
  409 conflict, 413 too large, 415 unsupported request encoding, 429 rate
  limited, 502 upstream S3 failure, 500 unexpected — plus 201 created and
  207 partial failure on success paths). Never return raw error messages
  from AWS or Prisma. Validation is the one deliberate exception:
  `validate(schema)` (`lib/middleware/validate.ts`) returns the first Zod
  issue's own message verbatim as `path: message`, with `code: "VALIDATION"`
  — those messages are written to be user-facing, unlike an AWS or Prisma
  exception's. Codes the web branches on live in `ErrorCode`
  (`@s3-viewer/types`): stored credentials that fail to decrypt or parse →
  409 `CREDENTIALS_UNREADABLE`; S3 rejecting the key pair
  (`InvalidAccessKeyId`, `SignatureDoesNotMatch`, expired tokens, or a 403 on
  `ListBuckets`) → 502 `CREDENTIALS_REJECTED`. Both carry a message the UI
  shows verbatim next to "Update credentials".
- `validate(schema)` middleware parses `{ ...req.query, ...req.body, ...req.params }`
  (params win) with a zod schema from `@s3-viewer/types` and stores the result
  on `res.locals.input` (typed helper `input<T>(res)`). Handlers read ONLY from it.
  Ids (`idSchema`) are 8–64 alphanumerics: Prisma cuids and Better Auth user ids.
  `contentType` is `type/subtype[;params]` in printable ASCII (blank → octet-stream).
- `authorize(permission, { scope: "server" | "bucket" })` runs after `validate`,
  reads `serverId` / `bucketName` from `res.locals.input`, loads roles, and
  stores `res.locals.auth = { serverRole, bucketRole, userId }`. `bucketName`
  must additionally be in `server.allowedBuckets` when that list is non-empty.
- Membership actions use `authorizeMemberAction()` which loads the target's
  current role and applies `canManageRole` for both current and new roles.
- Rate limits: global 1200/min per IP before auth on everything except
  `/servers/:serverId/buckets` and everything under it (`BUCKET_ROUTE`,
  `lib/middleware/rate-limit.ts`, matches the bucket collection route itself
  too, not just its subpaths), which instead gets its own 6000/min per IP
  (also before auth; bulk listing, upload and delete loops live there); then
  1800/min per user id;
  non-GET `/auth/*` 20/min per IP (Better Auth's own limiter is a no-op with
  `disableIpTracking`, so it is disabled) — this covers whatever Better Auth
  serves there (see "`/auth/*` routes" below); inside Better Auth's own `before`
  hook (`packages/auth/lib/throttle.ts`) password sign-in is 10/10min per
  email and verification / reset links 5/10min per email; `POST
/auth/sign-up/email` additionally 10/hour per IP counting only 2xx
  (`skipFailedRequests`, so the login page's sign-up fallback for a wrong
  password does not spend it); `establish`,
  `validate-buckets` and `PATCH …/credentials` 30/min per user. `TRUST_PROXY` env (default `loopback`)
  feeds `app.set("trust proxy", …)`.
- Parsers: `express.json({ limit: "1mb" })` only, skipped for `PUT …/objects`
  so the upload body reaches the handler as a raw stream. No urlencoded parser.
- Cross-site protection: `sameSite: "lax"` cookies plus an `Origin`/`Sec-Fetch-Site`
  check on every non-GET request, `/auth/*` included (allow only the
  `NEXT_PUBLIC_SITE_URL` origin; a request with neither header is rejected).
- `helmet()` with defaults. CORS origin = `siteOrigin` (`NEXT_PUBLIC_SITE_URL`),
  methods GET/PUT/POST/PATCH/DELETE/OPTIONS; allowed headers reflect the
  preflight (cors default), which covers the upload's `Content-Type`.
- S3 clients are cached per server (`lib/s3/client-cache.ts`, TTL 10 min, at
  most 500 entries, keep-alive agent, connect/request timeouts 5s/30s,
  `maxAttempts: 2`), invalidated on server delete and credential update.
  Credentials are decrypted once per cache fill. The only route that changes
  stored credentials is `PATCH /servers/:serverId/credentials` (owner): it
  decrypts the new blob, checks the endpoint, proves the keys work
  (`lib/s3/probe.ts`: HeadBucket on the first allowed bucket when the server
  has that list, ListBuckets otherwise; S3 failures keep their classified
  status/code), then stores the blob as sent, refreshes `provider` from the
  endpoint and drops the cached client. The cache keeps a per-server
  generation so a fill that raced the update never re-caches old keys.
- Endpoints are checked on `establish`, `validate-buckets`, `POST /servers`,
  `PATCH …/credentials`, and every S3-client cache fill (`getS3Client`,
  `lib/s3/client-cache.ts`) after decryption: https only in production, no
  localhost/private/link-local literals, and every DNS answer must be
  public. That check is a fast, friendly first pass; the same
  private/loopback/link-local rules
  (`lib/utils/endpoint.ts`) also run as a custom `dns.lookup` on the shared
  http/https agents S3 clients connect through (`lib/s3/client-cache.ts`), so
  a hostname that's repointed at a private address after passing the
  up-front check (DNS rebinding) still gets refused when a socket actually
  connects — surfaced as a classified 502, not a raw stack.
- S3 errors map through `lib/s3/errors.ts` (`NoSuchKey`/`NotFound` → 404,
  `AccessDenied` → 403, `NoSuchBucket`/`InvalidBucketName` → 400/404,
  `EntityTooLarge`/`InvalidRequest` copy-size → 413, rejected key pairs →
  502 `CREDENTIALS_REJECTED`, everything else → 502). `ListBuckets` alone
  uses `throwListBucketsError`, which also turns a 403 into
  `CREDENTIALS_REJECTED`: a server with no allowed-bucket list depends on
  that call. A 403 on `ListObjectsV2` stays 403 — prefix-scoped IAM is
  legitimate.
- Presigned URLs (downloads and previews only) expire in 15 minutes. They are
  used as navigations and `<img>`/`<video>`/`<audio>`/`<iframe>` sources, so
  buckets need no CORS configuration for any of that — with one exception:
  the JSON tree-view preview (`apps/web/lib/hooks/queries/s3/useObjectBody.ts`)
  does a cross-origin `fetch()` of the presigned URL to parse the body, which
  a bucket without CORS (or the app's own `connect-src` CSP, in production)
  silently degrades to a plain-text preview instead of a tree. Object keys
  are encoded with `encodeURIComponent` per path segment when building
  `CopySource`.
- Uploads stream through the API (`lib/s3/upload.ts`): `@aws-sdk/lib-storage`
  `Upload` with 4 parts in flight, `leavePartsOnError: false`; a client
  disconnect aborts the S3 upload. Part size defaults to 25 MiB, configurable
  via `UPLOAD_PART_BYTES` (min 5 MiB, S3's minimum; max 5 GiB, S3's maximum).
  `Content-Length`, when present, is checked against `MAX_UPLOAD_BYTES` (413)
  and passed to S3; the part size is then bumped above the configured value,
  when needed, so the upload stays under S3's 10,000-part cap, and the
  request is rejected (413) up front when even the maximum part size can't
  fit the declared length. The cached client's 30 s `requestTimeout` is a
  socket-idle timeout, so it is fine for the server→S3 leg.
  `server.requestTimeout = 5 min` and `headersTimeout = 60 s` keep long
  uploads alive without leaving a socket open forever.
- Credential encryption is hybrid: AES-256-GCM payload, key wrapped with
  RSA-OAEP(SHA-256). Wire format (base64 JSON): `{ v: 1, k, iv, ct }`. The
  private key must be at least 2048 bits (checked at startup).

### Routes (all under authGuard except `/auth/*`)

```
POST   /account/password                 { password }         → 204 (sets a first password on the signed-in account)
GET    /servers                                               → { servers: ServerInfo[] }
POST   /servers/establish                establishSchema      → { listBucketsAllowed, bucketCount, provider }
POST   /servers/validate-buckets         validateBucketsSchema→ { results: [{ bucketName, accessible }] }
POST   /servers                          createServerSchema   → { server: ServerInfo }
PATCH  /servers/:serverId                renameServerSchema   → { server: ServerInfo }
PATCH  /servers/:serverId/credentials    updateCredentialsSchema (UPDATE_CREDENTIALS) → { server: ServerInfo }
DELETE /servers/:serverId                (OWNER)              → 204
POST   /servers/:serverId/leave          (non-owner)          → 204
GET    /servers/:serverId/members        (MANAGE_MEMBERS)     → { members: ServerUser[] }
PATCH  /servers/:serverId/members/:userId updateRoleSchema    → { member: ServerUser }
DELETE /servers/:serverId/members/:userId removeMemberSchema  → 204
GET    /servers/:serverId/invites        (MANAGE_MEMBERS)     → { invites: ServerInvite[] }
POST   /servers/:serverId/invites        sendInviteSchema     → { invites: ServerInvite[], alreadyMembers: string[] }
DELETE /servers/:serverId/invites/:inviteId (MANAGE_MEMBERS, outrank invite role) → 204
GET    /invites                          (received, unexpired)→ { invites: ServerInvite[] }
GET    /invites/sent                      (sent by me, on servers where I still hold MANAGE_MEMBERS) → { invites: ServerInvite[] }
POST   /invites/:inviteId/accept                              → { server: ServerInfo }
POST   /invites/:inviteId/reject                              → 204
GET    /account/summary                  (what deleting the account removes) → AccountSummary
```

`GET /account/summary` returns `{ ownedServers: [{ id, name, memberCount,
pendingInviteCount }], memberships, sentInvites, receivedInvites }` for the
delete-account dialog: `memberCount` excludes the owner, `memberships` are
servers the caller belongs to but does not own, `sentInvites` are live invites
the caller sent on servers they do not own (invites on owned servers are
already counted under that server), and `receivedInvites` are live invites
addressed to the caller's email. Expired invites are not counted.

`/invites/*` require a verified email (403 `code: "EMAIL_UNVERIFIED"` otherwise):
invites are addressed to an address, and an OAuth provider may hand us an
unverified one. Accepting is atomic; a second concurrent accept gets 404.

A server may have at most `MAX_PENDING_INVITES` (30, `@s3-viewer/types`)
live (unaccepted, unrevoked, unexpired) invitations outstanding at once.
Expired rows for the server are deleted inside the same transaction before
the count, so they reclaim capacity rather than blocking it — matching the
`expiresAt > now` filter the replace check already used. A send whose new
rows would cross that count fails 409 with a message telling the sender to
revoke existing invites, naming `SUPPORT_EMAIL` for a higher limit only when
that variable is set; it never blocks a send that only updates existing
invites. The count-then-write is wrapped in a transaction that takes a
Postgres advisory lock on the server id
(`pg_try_advisory_xact_lock(hashtext(serverId))`) first, so two concurrent
sends for the same server can't both slip past the cap; a send that can't
take the lock fails 409 immediately rather than blocking toward the
interactive-transaction timeout. `POST .../invites` also
carries its own 20/min-per-user rate limit (`inviteLimit`) alongside the
generic 1800/min `userLimit`.

Emails are always stored and compared lowercase: `emailSchema` trims and
lowercases on every route that accepts one, and a `databaseHooks.user.create
/update.before` hook in `packages/auth/lib/auth.ts` normalizes `email` on
every user row regardless of path (Better Auth's own sign-up/OAuth endpoints
don't run through `emailSchema`). Invite and membership lookups compare
emails with plain equality, never `mode: "insensitive"`, so they use the
`@@index([email])` index instead of a sequential scan.

```

GET    /servers/:serverId/buckets                             → { buckets: S3Bucket[] }
POST   /servers/:serverId/buckets        { bucketName }       → { bucket: S3Bucket }
DELETE /servers/:serverId/buckets/:bucketName (DELETE_BUCKET; removes from server, DB only) → 204
GET    /servers/:serverId/buckets/:bucketName/objects?prefix&continuationToken&blockSize → S3ObjectListPage
GET    …/objects/metadata?objectKey                           → S3ObjectMetadata
POST   …/objects/exists                  { objectKeys[] }     → S3ObjectsExist `{ existing }` (≤ 1000 keys, 16 HEADs in flight)
GET    …/objects/download-url?objectKey                       → S3PresignedUrl
GET    …/objects/preview-url?objectKey                        → S3ObjectPreview (content type from HeadObject)
PUT    …/objects?objectKey&contentType   raw body (streamed)  → 201 S3ObjectUploaded `{ key, size, eTag }` (413 over MAX_UPLOAD_BYTES)
DELETE …/objects                         { objectKeys[] }     → S3DeleteResult (207 if any failed)
GET    …/objects/keys?prefix&continuationToken             → S3KeysPage `{ keys, nextToken }` (recursive, one S3 page of ≤ 1000 keys; prefix is a folder key ending in "/", never "/" or the root)
POST   …/objects/rename                  { objectKey, newObjectKey } → 204 (409 if target exists, 413 if > 5 GB)
```

Removed on purpose: a general-purpose copy/move route (no UI for it) —
`POST …/objects/rename` above is the one copy the API does, and only because
S3 has no native rename: it is a same-bucket `CopyObject` immediately
followed by a `DeleteObject` of the source, not a route for copying or
moving objects anywhere else. Also removed: `does-user-exist`, session IP
validation, folder-less single delete (use `objectKeys` with one key), and
presigned upload/multipart routes (uploads stream through the API instead,
so no bucket CORS is required).

### Limits

- A listing page makes at most 20 `ListObjectsV2` calls; each follow-up call
  asks only for the rows still missing.
- Recursive folder delete is a client pipeline: `GET …/objects/keys` pages
  sequentially (S3 tokens are ordered) while up to 4 `DELETE …/objects` calls
  run concurrently. No request outlives a proxy timeout; closing the dialog
  aborts the loop and the first failure aborts the rest. There is no size cap;
  the failure list shown is capped at 100 with a total count.

### Listing semantics

`GET …/objects` returns folders (common prefixes, `isFolder: true`, key ends
with `/`) and objects merged in S3 key order (UTF-8 bytes), so ordering is
consistent across pages, and keeps fetching from S3 until at least `blockSize`
rows are collected or the listing ends. `nextToken` is null at the end. The web
app's "Folders first" preference (persisted per browser in
`lib/stores/preferencesStore.ts`) regroups each 1000-row block client-side,
which is exact for listings up to 1000 entries and per-block above that.

## Auth (`packages/auth`, `apps/api`, `apps/web`)

- Two sign-in methods: email and password (always on) and GitHub (on when
  its credentials are set; the web shows the button only with
  `NEXT_PUBLIC_GITHUB_LOGIN_ENABLED=true`). There are no one-time codes and
  no magic links; email carries exactly two links, both `AuthLinkEmail`
  (`packages/ui/src/emails/auth-link.tsx`), both valid `AUTH_LINK_TTL_HOURS`
  (1).
- Password flow: `emailAndPassword` with `PASSWORD_MIN_LENGTH` (8) /
  `PASSWORD_MAX_LENGTH` (128) from `@s3-viewer/types` (`passwordSchema`),
  `requireEmailVerification: false`, `revokeSessionsOnPasswordReset: true`.
  Sign-in and sign-up are one flow: `continueWithPassword`
  (`packages/auth/lib/client.ts`) tries `/sign-in/email`, and on
  `INVALID_EMAIL_OR_PASSWORD` tries `/sign-up/email` (name = local part);
  `USER_ALREADY_EXISTS` there means a wrong password, anything else created
  the account. Passwords are validated against `passwordSchema` before
  either request. A new account starts signed in; the web shows a toast and
  goes straight to the destination.
- Verification: `emailVerification.sendOnSignUp` sends the link at sign-up;
  `/send-verification-email` (throttled per address) resends it from
  Settings → Profile and from `UnverifiedCallout` in the invite surfaces.
  The link is Better Auth's `/auth/verify-email?token=…&callbackURL=…`
  with the profile page as callback, which shows the address's status and
  toasts on `?error=`. `autoSignInAfterVerification` stays off — the link
  never signs anyone in. `requireVerifiedUser` gates everything that binds
  value to the address: connecting a server (`establish`,
  `validate-buckets`, `POST /servers`; the credentials belong to whoever
  can reset the account's password) and invites (sending, listing and
  accepting, because they are matched by address). The web checks
  `session.user.emailVerified` first and shows `UnverifiedCallout` instead
  of the form.
- Reset: `/request-password-reset` with `redirectTo = /reset-password`
  (throttled per address, always 200); Better Auth's `/auth/reset-password/:token`
  callback lands on `/reset-password?token=…` (or `?error=INVALID_TOKEN`);
  `/reset-password` with the token sets the password, creating the
  `credential` account when there is none (GitHub-only users), and the web
  sends the user to `/login?reason=reset`. `POST /account/password` wraps
  Better Auth's server-only `setPassword` for the same "first password"
  case from Settings and, because it claims the account without knowing a
  password, requires a session younger than `SESSION_FRESH_HOURS` (403
  `SESSION_STALE`; `authGuard` puts the session row on `req.session` for
  this); the web checks the same age and offers "Sign in again".
  `/change-password` needs the current one and signs out other sessions.
- A failed link email is logged (`[auth] verify email failed` / `[auth] reset
email failed`) and never fails the request that caused it: the account
  already exists, and the response must not reveal delivery.
- GitHub OAuth is optional: enabled only when `GITHUB_CLIENT_ID` is set; the web
  shows the button only when `NEXT_PUBLIC_GITHUB_LOGIN_ENABLED=true`.
- No profile pictures. Name and email are the whole profile; the avatar is
  generated from the name (`apps/web/lib/utils/avatar.ts`) and is never stored,
  uploaded or editable. The `user.image` column stays because Better Auth's core
  user model declares it, but nothing writes it: `mapProfileToUser` drops
  GitHub's `avatar_url`, `databaseHooks.user.create.before` forces `image: null`,
  and `validateProfile` strips any `image` off an `/update-user` body.
- Cookies: `sameSite: "lax"`, `secure` when `NEXT_PUBLIC_API_URL` is https, `httpOnly`.
  `advanced.ipAddress.disableIpTracking: true`. Session 30 days, refreshed daily.
  Neither IP address nor user-agent is stored: `ipAddress` stays a column that
  is always null (Better Auth's own option), while `userAgent` has no column
  at all — nothing ever read it, so it's dropped by a
  `databaseHooks.session.create.before` hook that deletes the field (the
  column no longer exists to null) plus a migration removing it from
  `session`.
- Account deletion: `user.deleteUser` is enabled (`POST /auth/delete-user`) and
  `session.freshAge` is `SESSION_FRESH_HOURS` (24, `@s3-viewer/types`), which
  the web reads too, so a session older than that is sent to sign in again
  instead of hitting Better Auth's `SESSION_EXPIRED`. `packages/auth` cannot
  import from `apps/api`, so it exposes `onUserDeletion({ beforeDelete,
afterDelete })` and forwards Better Auth's `deleteUser` hooks to whatever is
  registered — `beforeDelete` throws when nothing is, so a user row can never
  vanish without the erasure below. `apps/api/server.ts` registers
  `lib/services/account.ts` at startup. `beforeDelete` runs one Prisma
  transaction that collects the ids of the servers the user owns, deletes
  `PendingInvitation` rows addressed to their email (the cascade misses those:
  they are joined by address, not by id), rewrites every `AuditLog.target`
  equal to their email to `[deleted user]` (`actorId` is kept — it resolves to
  nobody once the row is gone, and the trail must stay intact for the other
  members). Better Auth then deletes the user, which cascades sessions,
  accounts, memberships, bucket grants, invitations they sent AND every server
  they own (with all of its members' access and pending invites — a server's
  credentials belong to its owner). `afterDelete` invalidates the cached S3
  client of every collected server (after the cascade, so a racing request
  cannot refill the cache), records `account.delete` with the user as actor
  (only here, so a `deleteUser` that fails after `beforeDelete` leaves no
  entry claiming a deletion happened) and sends `AccountDeletedEmail`; an
  email failure is logged as `Account deletion email failed`, never thrown,
  because the account is already gone.
- Sign-out clears the react-query cache and the session store.

### `/auth/*` routes

`server.ts` mounts `app.all` for every method on every `/auth/*` path
(Express's catch-all param) straight through to Better Auth's own router
via `toNodeHandler(auth)`. That hands Better Auth its full core endpoint
surface there — session management (`/get-session`, `/sign-out`,
`/list-sessions`, `/revoke-session(s)`, …), account management
(`/update-user`, `/delete-user`, `/change-password`, `/list-accounts`, …),
email and password (`/sign-in/email`, `/sign-up/email`,
`/request-password-reset`, `/reset-password`, `/send-verification-email`,
`/verify-email`) and — when `GITHUB_CLIENT_ID` is set — `/sign-in/social`
and `/callback/:id` for GitHub. No plugins are registered. The `before`
hook in `packages/auth/lib/auth.ts` runs for HTTP requests and `auth.api.*`
calls alike and holds the per-email throttles (429 with code
`RATE_LIMITED`); nothing is pre-blocked in `server.ts`.

## Web (`apps/web`)

- `lib/api.ts`: `api.get/post/patch/delete<T>(path, body?)` throwing `ApiError`
  (from `{message, code}`); all hooks use it. No other `fetch`. The one XHR is
  `utils/s3/uploadObject.ts` (upload progress events), which rejects with the
  same `ApiError`.
- Query keys from `lib/queryKeys.ts`, every key starts with `["user", userId]`;
  `queryClient.clear()` on sign-out. `staleTime` 5 min default;
  `refetchOnWindowFocus: false` for presigned-URL queries.
- `usePermission(permission, bucketName?)` returns a boolean from the current
  server role and the bucket's `userRole`; every action button is gated with it.
  Buttons the user cannot use are NOT rendered (not disabled).
- Command menu (`⌘K`, `apps/web/components/CommandMenu` +
  `lib/command-menu`): one dialog over the catalog `useCommands` builds from
  data the app already has — pages, the current server's buckets, the other
  servers, and the actions the user's role allows. It opens no queries of its
  own and calls no search endpoint. `match.ts` scores a term as exact >
  prefix > word-boundary > substring > subsequence, and only the label is
  matched loosely — keywords are substring-only, or a four-letter
  subsequence would hit every row. `rank.ts` groups the hits and floats the
  group holding the best one. Recently used ids are kept in `localStorage`
  and resolved against the live catalog, so a bucket you lose access to just
  stops appearing.
- Toasts only after the request resolves; never "success" for partial failures.
  Errors show `ApiError.message`.
- Loading states are spinners inside containers that already have the final size; skeletons only for large, known-shape areas. Toolbars never swap controls (disable instead).
- Uploads: one `PUT …/objects` per file, streamed through the API into the
  bucket — no bucket configuration needed; `contentType` defaults to
  `application/octet-stream`; 3 files at a time; 2 retries on network errors
  only (never on a 4xx/5xx); cancel aborts the request; duplicate-key check
  (`POST …/objects/exists`, 1000 keys per call) before upload; entries keyed
  by `bucket/prefix/name`. Batched key requests (`exists`, `DELETE …/objects`)
  are split by `chunkKeys` (≤ 1000 keys and ≤ 256K characters per call) so a
  body never nears the 1 MB JSON limit. The grid datasource keeps one
  continuation token per 1000-row block and lets AG Grid own the row cache
  (`maxBlocksInCache: 10`), so paging deep costs one short string per block,
  not the rows, and a purged block refetches directly from its known token
  instead of re-walking the listing. Downloads and
  previews use 15-minute presigned URLs, which need no CORS.
- Login/signup page: one `AuthScreen` component inside `AuthLayout`; mobile
  = form only, desktop = split (form left, brand panel right on Viewer Dark
  Blue). `SignInForm`: optional GitHub button, email, password, primary
  "Sign in" / "Create account", a centred "Forgot password?" link. Both
  pages run the same flow (see Auth); `?reason=reset` and an oauth `?error=`
  show a notice. `/forgot-password` (`ForgotPasswordScreen`): email → "Check
  your inbox" with send-again; `useStepHeight` keeps the first step's height
  so the legal footer never moves. `/reset-password`
  (`ResetPasswordScreen`): new password from `?token=`, or a "request a new
  link" screen without one. Settings → Profile has a Password card (set or
  change) and a "Resend verification email" link for an unverified address;
  `UnverifiedCallout` in the invite surfaces resends it too
  (`useResendVerification`). See `packages/ui/DESIGN.md`.

## Landing (`apps/landing`)

Only describe what ships (see routes and web notes). No
cross-provider copy, no versioning prompts, no bulk download, no audit log,
no side-by-side. Rename refuses to overwrite and is limited to 5 GB. Search
is a prefix filter inside the current folder. Share link = 15-minute presigned
URL from the object's "Copy link" action. Uploads stream through the S3 Viewer
server to the bucket (nothing to configure on the bucket) and retry on network
errors; downloads go straight from the bucket to the browser. Legal pages must
match the README "Data we store" section.
