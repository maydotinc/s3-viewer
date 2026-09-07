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
- Icons come from `lucide-react` everywhere (`apps/web`, `packages/ui`).
  `react-icons` is only for third-party brand marks (`FaGithub`,
  `FaLinkedinIn`) in `apps/landing`.
- Shared dependency versions live in the pnpm `catalog:` in
  `pnpm-workspace.yaml`; packages reference them with `"<dep>": "catalog:"`.
  Bump the version there, never in a package's `package.json`.
- Commits follow Conventional Commits (`feat(web): …`, `fix(api): …`,
  `chore(deps): …`). Schema changes commit the generated Prisma migration.

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
  exception's. Better Auth's `APIError` (thrown by `auth.api.*` calls such as
  `setPassword`) is the other: `errorHandler` answers with its own status and
  message, never a 500. Codes the web branches on live in `ErrorCode`
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
  IP+email (the IP arrives in `CLIENT_IP_HEADER`, which `server.ts` overwrites
  with `req.ip` on every `/auth/*` request so a client can't pick its own
  key) with a 60/10min per-email backstop, and verification / reset links
  5/10min per email; `POST
/auth/sign-up/email` additionally 10/hour per IP counting only 2xx
  (`skipFailedRequests`, so the login page's sign-up fallback for a wrong
  password does not spend it); `establish`,
  `validate-buckets` and `PATCH …/credentials` 30/min per user (`connectLimit`);
  `POST …/objects/exists` 60/min per user (`existsLimit`, since one call can
  fan out into hundreds of upstream HEADs). `TRUST_PROXY` env (default `loopback`)
  feeds `app.set("trust proxy", …)`. `RATE_LIMIT_STORE` (`memory` default |
  `postgres`, `lib/env.ts`) moves the security-relevant limiters —
  `authRouteLimit`, `signUpLimit`, `connectLimit`, `inviteLimit` and
  `existsLimit`, each with its own store instance and key prefix
  (`lib/middleware/rate-limit-store.ts`, backed by `@s3-viewer/db/rate-limit`)
  — into Postgres, so every API replica shares one budget instead of each
  keeping its own; `globalIpLimit`, `bucketIpLimit` and `userLimit` always
  stay in memory on purpose, since a database write before auth on every
  request would amplify a flood rather than absorb it. With `postgres` and
  the database unreachable, the shared limiters fail closed (429) rather than
  passing traffic through unlimited. A background sweep (`lib/maintenance.ts`,
  hourly, run once at boot) clears their expired rows.
- Parsers: auth routes first consume a bounded text body (64 KiB, all content
  types, including chunked requests) before Better Auth's adapter parses it;
  compressed auth bodies are rejected (415), oversized bodies return 413.
  Other routes use `express.json({ limit: "1mb" })`, skipped for `PUT …/objects/v3/upload` and the rejected legacy upload paths
  so the upload body reaches the handler as a raw stream. No urlencoded parser.
- Cross-site protection: `sameSite: "lax"` cookies plus an `Origin`/`Sec-Fetch-Site`
  check on every non-GET request, `/auth/*` included (allow only the
  `NEXT_PUBLIC_SITE_URL` origin; a request with neither header is rejected).
- `helmet()` with defaults. CORS origin = `siteOrigin` (`NEXT_PUBLIC_SITE_URL`),
  methods GET/PUT/POST/PATCH/DELETE/OPTIONS; allowed headers reflect the
  preflight (cors default), which covers the upload's `Content-Type`.
- S3 clients are cached per server (`lib/s3/client-cache.ts`, TTL 10 min, at
  most 500 entries, keep-alive agents shared by every client with explicit
  caps — `S3_MAX_SOCKETS_PER_HOST` per host (100), `S3_MAX_TOTAL_SOCKETS` in
  total (1000), 64 idle, 60 s socket idle timeout — because an agent instance
  handed to the SDK replaces its own 50-socket default; connect/request
  timeouts 5s/30s, `maxAttempts: 2`), invalidated on server delete and
  credential update. Each cached client (and every regional client built from
  it in `lib/s3/bucket-client.ts`) also carries a per-server upstream budget:
  `withRequestBudget` (`lib/s3/request-budget.ts`) adds an SDK middleware that
  counts `client.send` calls per server in a rolling 60 s in-memory window and,
  past `S3_REQUESTS_PER_MINUTE` (default 12000, per server **per API process**),
  throws a 429 `RATE_LIMITED` before the request leaves the process. Clients
  from `getS3ClientFromCredentials` (connect/validate-buckets/credential
  probes) are exempt. Every lookup reads the
  current encrypted credentials and provider from PostgreSQL before reusing
  a client, so other API workers observe credential updates and server deletion.
  A database failure never falls back to a cached client. Cache fills recheck
  the persisted identity after endpoint validation; concurrent changes retry at
  most three times before returning 409. Requests that already obtained a
  client may finish while credentials change.
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
  silently degrades to a plain-text preview instead of a tree. The preview
  presign forces `ResponseContentType: text/plain` for HTML, XHTML and XML
  and `ResponseContentDisposition: attachment` for SVG (`inlineContentType`
  / `inlineDisposition`, `lib/s3/keys.ts`) so markup that can carry script
  never renders on the storage origin when the URL is opened directly —
  `<img>` ignores the disposition, so the in-app SVG preview is unchanged;
  the response's `contentType` field still reports the stored type. Object keys are encoded
  with `encodeURIComponent` per path segment when building `CopySource`.
  Every key and list prefix passes `isSafeKeyText` (`@s3-viewer/types`): no
  leading `/`, no control characters, no lone UTF-16 surrogates (the SDK's
  URI encoder throws on those).
- Uploads stream through the API (`lib/s3/upload.ts`). New keys use
  `IfNoneMatch: "*"`; confirmed replacements carry the ETag observed before
  confirmation as `expectedETag`, mapped to `IfMatch`. Wildcards, weak ETags
  and ETag lists are rejected. Both AWS `PutObject` and
  `CompleteMultipartUpload` enforce the condition; conflicts return 409 and
  never fall back to an unconditional write. Storage writes use one SDK
  attempt. Browser network retries apply only to new files and retain the
  absent-key condition. Overwrites with uncertain outcomes require a fresh
  review instead of automatic replay, because ETags can survive metadata changes.
  AWS S3, R2, and compatible endpoints use `@aws-sdk/lib-storage` `Upload`
  with 2 parts in flight and `leavePartsOnError: false`. R2 also receives
  its documented initiation conditions for multipart uploads. There is no
  R2-specific single-request size cap. Canonical Backblaze B2 endpoints refuse
  uploads before reading the body because conditional writes have not been
  verified there. The actual
  client's endpoint determines protocol adaptations, without loading a
  separate server snapshot. Only R2 supports replacements. AWS and other
  endpoints refuse an `expectedETag` upload before storage mutation or body
  consumption: content conditions cannot preserve concurrent ACL/tag permission
  changes. The route also checks availability before regional discovery. R2
  replacements read `HeadObject` with the reviewed ETag and preserve metadata,
  content type, cache/disposition/language and storage class; R2 has no object
  ACL/tag APIs. They re-read the same snapshot before PUT or multipart
  publication. Opaque KMS/SSE-C settings, missing metadata and content encodings
  that cannot safely describe new local bytes block replacement before writing.
  Use a new name for these objects. No required read failure falls back to defaults.
  These reads do not atomically protect mutable metadata against external writers.
  All providers use the same admission budget,
  bounded buffers, and inactivity watchdog. A client
  disconnect aborts the input and S3 requests. Reservations are held until
  workers finish and multipart cleanup settles (cleanup has its own 10 s
  deadline). Part size defaults to 5 MiB, configurable
  via `UPLOAD_PART_BYTES` (min 5 MiB, S3's minimum; max 5 GiB, S3's maximum).
  `Content-Length`, when present, is checked against `MAX_UPLOAD_BYTES` (413)
  and passed to S3; the part size is then bumped above the configured value,
  when needed, so the upload stays under S3's 10,000-part cap, and the
  request is rejected (413) up front when even the maximum part size can't
  fit the declared length. The cached client's 30 s `requestTimeout` is a
  socket-idle timeout, so it is fine for the server→S3 leg.
  `MAX_CONCURRENT_UPLOADS` (6) and `MAX_USER_UPLOADS` (3) bound active uploads
  per API process. Each reserves four part buffers against
  `UPLOAD_MEMORY_BUDGET_BYTES` (256 MiB); saturation returns 429 with
  `Retry-After: 5`, and a reservation larger than the entire budget returns 413. The configured base part size must fit or startup fails. This budget
  covers upload buffers, not total process memory.
  `server.requestTimeout = 0` permits long active uploads;
  `keepAliveTimeout` (`KEEP_ALIVE_TIMEOUT_MS`, default 65 000 ms — set it
  above any load balancer's own idle timeout, or the balancer reuses a
  keep-alive socket Node has just closed) and `headersTimeout`
  (`KEEP_ALIVE_TIMEOUT_MS + 5_000`; Node ignores `headersTimeout` unless it is
  strictly greater than `keepAliveTimeout`) bound the connection phases, and
  socket inactivity deadlines bound stalls.
  Auth and pre-handler requests have a two-minute socket deadline; upload
  handlers use a streaming watchdog with `UPLOAD_IDLE_TIMEOUT_MS` (120000),
  returning 408 on an input stall when the connection is still writable.
  It pauses during S3 backpressure and stops at input EOF; active S3 requests
  and completion use the S3 client's own idle timeout. Failed completion
  explicitly aborts multipart parts, since the SDK only cleans worker failures.
- Credential encryption is hybrid: AES-256-GCM payload, key wrapped with
  RSA-OAEP(SHA-256). Wire format (base64 JSON): `{ v: 1, k, iv, ct }`. The
  private key must be at least 2048 bits (checked at startup).
  The encrypted payload contains endpoint, region, access key, secret key,
  and an optional session token for temporary AWS/R2 credentials. Tokens
  are passed to the SDK for both API requests and presigned URLs; they are
  never renewed automatically. A presigned URL can stop working when its
  temporary token expires, earlier than the URL's signature expiry.
  Expiration returns 502 `CREDENTIALS_REJECTED`
  with a message to update all three credential values. Key-pair-only
  envelopes remain valid. The envelope is bounded at 64 KiB to accommodate
  longer session tokens. Both credential forms accept any region string;
  an empty region uses the B2 region from its endpoint, `auto` for R2, or
  `us-east-1` otherwise. An explicit region always wins.
  `BETTER_AUTH_SECRET` and `ENCRYPTION_PRIVATE_KEY` are required, except when
  `DATA_DIR` is set: they are then read from `$DATA_DIR/auth-secret` and
  `$DATA_DIR/encryption-private-key.pem`, generated (32 random bytes base64; RSA
  4096 pkcs8 PEM) and written `0600` on first boot. That runs in `lib/env.ts`
  before validation and before `@s3-viewer/auth` reads the secret, which is why
  `@/lib/env` is `server.ts`'s first import.
- SSRF: S3 endpoints must be public https, and every DNS answer is re-checked
  at connect time (`lib/utils/endpoint.ts`, `publicOnlyLookup`).
  `ALLOW_PRIVATE_ENDPOINTS=true` (exactly that string) accepts private,
  loopback and link-local addresses plus `localhost` / `*.localhost`, and
  accepts `http://` in production too — a MinIO on a LAN is almost always
  plain http. It is for a trusted network only and logs a loud boot warning;
  anything but `true` keeps the default behaviour unchanged.

### Public routes (no auth, no session)

```
GET    /health                                                → { ok: true, apiVersion: API_CONTRACT_VERSION }
GET    /config                                                → { encryptionPublicKey, githubLoginEnabled, emailEnabled }
```

`GET /config` is what lets one prebuilt web image serve any install: the web
app reads all three at runtime instead of from build-time env vars
(`NEXT_PUBLIC_ENCRYPTION_PUBLIC_KEY` and `NEXT_PUBLIC_GITHUB_LOGIN_ENABLED`
are removed from `apps/web/.env`). `encryptionPublicKey` is the SPKI PEM
derived from `ENCRYPTION_PRIVATE_KEY` at boot (`lib/utils/encryption.ts`),
`githubLoginEnabled` is `GITHUB_CLIENT_ID` being set, `emailEnabled` is the
resolved `EMAIL_TRANSPORT` not being `none`. It is mounted after
`globalIpLimit` so it counts against the same per-IP budget, answers
`Cache-Control: public, max-age=60`, and its values are computed once at boot
— a change to any of them needs an API restart. `/health` is mounted before
the limiter so a health check never spends it.

### Routes (all under authGuard except `/auth/*` and the public routes above)

```
POST   /account/password                 { password }         → 204 (sets a first password on the signed-in account)
GET    /account/audit?cursor&limit                            → AuditLogPage (the caller's own `auth.*`/`account.*` rows, actorId = me; same shape and pagination as the server audit route below)
GET    /servers                                               → { servers: ServerInfo[] }
POST   /servers/establish                establishSchema      → { listBucketsAllowed, bucketCount, provider }
POST   /servers/validate-buckets         validateBucketsSchema→ { results: [{ bucketName, accessible }] } (≤ MAX_VALIDATE_BUCKETS = 20 per call, the web chunks; a host that can't be reached fails the call 502 instead of marking every bucket inaccessible)
POST   /servers                          createServerSchema   → { server: ServerInfo } (cap check and insert under a blocking per-owner advisory lock)
PATCH  /servers/:serverId                renameServerSchema   → { server: ServerInfo }
PATCH  /servers/:serverId/credentials    updateCredentialsSchema (UPDATE_CREDENTIALS) → { server: ServerInfo }
DELETE /servers/:serverId                (OWNER)              → 204
POST   /servers/:serverId/leave          (non-owner)          → 204
GET    /servers/:serverId/members        (MANAGE_MEMBERS)     → { members: ServerUser[] }
GET    /servers/:serverId/audit?cursor&limit (MANAGE_MEMBERS) → AuditLogPage `{ entries: AuditLogEntry[], nextCursor }` (newest first, keyset-paginated on `[serverId, createdAt]` with the row id as tiebreaker; opaque base64url cursor of `createdAt|id`, 400 on a malformed one; `limit` 1–100, default 50; `actorEmail`/`actorName` resolved from the user table, `null` once the account is gone)
PATCH  /servers/:serverId/members/:userId updateRoleSchema    → { member: ServerUser }
DELETE /servers/:serverId/members/:userId removeMemberSchema  → 204
GET    /servers/:serverId/invites        (MANAGE_MEMBERS, unexpired) → { invites: ServerInvite[] }
POST   /servers/:serverId/invites        sendInviteSchema     → { invites: ServerInvite[], alreadyMembers: string[] }
DELETE /servers/:serverId/invites/:inviteId (MANAGE_MEMBERS, outrank invite role) → 204
GET    /invites                          (received, unexpired)→ { invites: ServerInvite[] }
GET    /invites/sent                      (sent by me, unexpired, on servers where I still hold MANAGE_MEMBERS) → { invites: ServerInvite[] }
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
unverified one. Accepting is atomic; a second concurrent accept gets 404. An
invite is only as good as its sender's current authority: `stillGrantable`
(`lib/services/invite-authority.ts`) keeps only invites whose sender is still
an authorized member, outranks every invited role, and currently holds each
bucket grant they are offering within the server's allowed bucket scope.
Owners have implicit bucket authority. `GET /invites` filters through it;
acceptance re-checks inside a transaction, answering 404 otherwise. Sending,
accepting, revoking, membership changes and bucket-scope changes serialize
on the server row lock. Permission reductions also delete invalid pending
invites in that transaction, so restoring access cannot revive them. Every invite listing uses the one
`liveInvite()` filter, so expired rows never show.

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

One `auditLog` row is written per action in `AuditAction` (`@s3-viewer/types`):
server/credential/membership/invite changes and bucket/object deletion or
rename, plus the auth actions below. `recordAudit` (`lib/services/audit.ts`)
never throws — a failed write is logged, not surfaced to the caller.
`GET /servers/:serverId/audit` and `GET /account/audit` share one keyset-paginated
reader, `listAuditPage({ where, cursor, limit })`, differing only in their
`where` (a server id for the first, `actorId = me` for the second, over the
same `[actorId, createdAt]` index); `auditQuerySchema` is
`serverScope.merge(auditPageSchema)`, with `auditPageSchema` (cursor + limit)
reused by both routes. `AuditLog` also carries a bare `@@index([createdAt])`
for the prune below, which filters on age alone across every server. Rows are
kept forever by default; `AUDIT_RETENTION_DAYS` (0, `lib/env.ts`) past 0
prunes rows older than that many days, deleted in bounded batches of 5000
with a pause between them rather than one long-locking statement, so turning
on retention against an old, large backlog doesn't stall other writers.
`startMaintenance()` (`lib/maintenance.ts`, called from `server.ts` after
`listen`) runs the prune and `sweepRateLimits()` once at boot and then hourly
on an `.unref()`ed timer, logging one info line with both totals; every
replica runs it, and the deletes are idempotent.
`POST /account/password` (setPassword) records `auth.password_set`; every
other auth action is emitted by `@s3-viewer/auth`'s `onAuthEvent`, registered
once as `onAuthEvent(recordAudit)` in `server.ts` (see "Auth" below for the
full list). Deleting an account rewrites, rather than deletes, the audit rows
that named the departed user (see "Account deletion").

```

GET    /servers/:serverId/buckets                             → { buckets: S3Bucket[] }
POST   /servers/:serverId/buckets        { bucketName }       → { bucket: S3Bucket }
DELETE /servers/:serverId/buckets/:bucketName (DELETE_BUCKET; removes from server, DB only) → 204
GET    /servers/:serverId/buckets/:bucketName/objects?prefix&continuationToken&blockSize → S3ObjectListPage
GET    …/objects/metadata?objectKey                           → S3ObjectMetadata
POST   …/objects/exists                  { objectKeys[] }     → S3ObjectsExist `{ existing, eTags }` (UPLOAD_OBJECT, not the broader LIST_OBJECTS every other route on this router takes — only the upload flow calls it; existsLimit; ≤ 1000 keys; listings first, then ≤ MAX_EXISTS_HEADS = 200 HEADs at 16 in flight; keys past that cap read as existing without an ETag and cannot authorize replacement; one AbortSignal per request, see Limits)
GET    …/objects/download-url?objectKey                       → S3PresignedUrl
GET    …/objects/preview-url?objectKey                        → S3ObjectPreview (content type from HeadObject)
PUT    …/objects/v3/upload?expectedUserId&objectKey&contentType&expectedETag?   raw body (streamed)  → 201 S3ObjectUploaded `{ key, size, eTag }` (409 on upload conflict; 413 over MAX_UPLOAD_BYTES/object limit)
DELETE …/objects/v3                      { expectedUserId, objects: [{ key, expectedETag }] }     → S3DeleteResult `{ deleted, failed: [{ key, message, retryable }] }` (207 if any failed; expectedETag may be null)
GET    …/objects/keys?prefix&continuationToken             → S3KeysPage `{ objects: [{ key, expectedETag }], nextToken }` (recursive, one S3 page of ≤ 1000 keys; prefix is a folder key ending in "/", never "/" or the root)
POST   …/objects/v3/rename               { expectedUserId, objectKey, newObjectKey, expectedETag } → 409 (unavailable; validation and authorization still apply, no storage requests)
```

Object deletion executes on recognized AWS S3 and R2 endpoints, with a valid,
non-null reviewed ETag on every submitted object. Null/invalid tags produce
nonretryable per-key failures; valid entries in a mixed batch can proceed.
AWS sends atomic batch ETag conditions. R2 checks each key with `HeadObject`
and `IfMatch`, verifies the returned ETag, then sends ordinary `DeleteObject`.
That R2 check does not atomically bind the DELETE: an external replacement
between requests can still be removed. R2's confirmation explains permanence
and asks users to pause other writers. Missing objects need no DELETE.
B2 and other compatible endpoints return nonretryable failures without issuing
DELETE. Every destructive request
uses `withoutRetries` (one SDK attempt). Confirmed per-key failures can be retried,
except stale preconditions. Missing, contradictory and uncertain results require
refresh and review. The app never supplies VersionId to purge historical versions.
Unversioned AWS deletes can be permanent; ETags identify content, not all mutable
metadata. Versioning/recovery remains relevant even with conditional deletion.

`POST …/objects/v3/rename` retains its validated request shape and account/bucket
authorization but always returns an explicit 409 before client acquisition.
The unsafe copy/delete implementation has been removed. Versioning can retain
bytes but cannot make a two-key rename preserve concurrent tag/ACL permission
revocation. Download and upload under a new filename is an explicit alternative.
See
[provider compatibility](./PROVIDER-COMPATIBILITY.md) for permissions and test scope.

Removed on purpose: general copy/move, `does-user-exist`, session IP validation,
separate single-object delete, and presigned upload/multipart routes. Uploads
stream through the API, so no bucket CORS configuration is required.

API contract version 4 keeps `/objects/v3` for delete and its `/upload` and
`/rename` children for other mutations. Each requires `expectedUserId`, matched
against the authenticated actor before storage access. Older API workers
return 404 for these new paths. The new API rejects every legacy mutation
path with 409 and a refresh message, preventing old clients from bypassing the
identity and ETag requirements during rolling deployments.
Version 4 adds account-bound deletion confirmation, an account identity in its
impact summary, and provider capability flags. Deploy matching API/web versions.

Every `ServerInfo` response includes `capabilities: { upload, replace, rename,
delete, notice }`. `upload` means creating a new absent key; `replace` is R2-only;
`rename` is currently false for all providers; `delete` supports AWS and R2. B2 is still
stored as `Other`, but its encrypted endpoint is inspected internally to return
upload=false. Neither encrypted credentials nor endpoints are included in responses.
Clients with missing capability data must disable mutations. The flags describe
provider availability and are always intersected with the user's permissions.

AWS bucket operations resolve the bucket's region with `HeadBucket`, including
the region header on regional redirects and permission-denied responses. Actual
requests and presigned URLs use the discovered region/endpoint. Regional clients
retain DNS/SSRF checks, single-attempt mutation behavior and current credential
authority checks; invalidating a base client also invalidates its regional clients.
Transient probes are weakly held. R2/B2/Other endpoints are not rewritten.

Bucket creation checks existence for every role, including owners. It never
treats an existing bucket as newly created or retries an uncertain S3 create;
AWS us-east-1 can reset an existing bucket's ACL on repeated `CreateBucket`.
A per-bucket PostgreSQL advisory transaction lock serializes app requests
across replicas and duplicate server connections. The transaction is bounded
to 65 seconds and holds no server row lock while waiting on S3. Creation uses
a fresh client built from one encrypted-credential/provider snapshot. After
S3 returns, the transaction locks the server row, verifies the snapshot is
unchanged, reloads the actor's current role, and grants access only if that
role still permits creation. Existing grants are retained, never raised.
A bucket created just before revocation or credential rotation remains in
storage without new access grants; it is never automatically deleted. The
advisory lock cannot coordinate external console/CLI bucket creators.
Bucket removal rechecks the actor's role inside its transaction after acquiring
the same server row lock as membership and invitation changes, before removing
bucket scope, grants, or invitations.

### Limits

- A listing page makes at most 20 `ListObjectsV2` calls; each follow-up call
  asks only for the rows still missing.
- Every bucket and object route that can make more than one S3 call (bucket
  listing, object listing, `keys`, `exists`, `DELETE …/objects/v3`) passes one
  `AbortSignal` per request (`requestSignal`, `lib/http.ts`: aborted when the
  client disconnects or after `S3_ROUTE_TIMEOUT_MS` = 60 s) into every
  `client.send`, so a fan-out never outlives its caller; an aborted call
  surfaces as the classified 502.
- Recursive folder delete lists one page, deletes its captured targets, then
  advances to the next page. Closing or unmounting the dialog aborts its loop.
  All failed target keys and original ETags are retained; only their display
  is capped at 100. Retry submits only confirmed retryable failures. Uncertain
  outcomes remain visible and require a fresh review. Retry never relists a folder or silently refreshes
  ETags. Missing/repeated continuation tokens and listing errors leave deletion
  visibly incomplete, even if all previously listed failures later succeed.

### Listing semantics

Bucket listings use AWS continuation tokens and R2
`cf-next-continuation-token` headers. Repeated tokens, missing R2 tokens on
truncated pages, and the 50-page budget return an error instead of silently
claiming the listing is complete. Credential probes use the same paginator.

`GET …/objects` returns folders (common prefixes, `isFolder: true`, key ends
with `/`) and objects merged in S3 key order (UTF-8 bytes), so ordering is
consistent across pages, and keeps fetching from S3 until at least `blockSize`
rows are collected or the listing ends. `nextToken` is null at the end. The web
app's "Folders first" preference (persisted per browser in
`lib/stores/preferencesStore.ts`) regroups each 1000-row block client-side,
which is exact for listings up to 1000 entries and per-block above that.

## Auth (`packages/auth`, `apps/api`, `apps/web`)

- Two sign-in methods: email and password (always on) and GitHub (on when
  its credentials are set; the web shows the button only when
  `GET /config` reports `githubLoginEnabled`). There are no one-time codes and
  no magic links; email carries exactly two links, both `AuthLinkEmail`
  (`packages/ui/src/emails/auth-link.tsx`), both valid `AUTH_LINK_TTL_HOURS`
  (1).
- Sign-up policy: `SIGNUP_MODE` (`open` default | `domains` | `invite` |
  `closed`, `packages/auth/lib/env.ts`) with `ALLOWED_EMAIL_DOMAINS`
  (comma/whitespace separated, leading `@` stripped, lowercased, deduped); an
  unset mode infers `domains` when the list is non-empty, `domains` with an
  empty list is a boot error, and `invite` needs no list. Who may create an
  account: `open` — anyone; `domains` — a listed domain **or** any address
  holding a live (unexpired) pending invitation; `invite` — a live pending
  invitation only; `closed` — nobody, invitation or not (every invite-accept
  path needs a signed-in user, so `closed` would otherwise dangle an invite
  its recipient could never accept). Better Auth's own `disableSignUp`
  (`emailAndPassword` and the GitHub provider) is set only for `closed`;
  `domains`/`invite` are enforced solely in the `databaseHooks.user.create.before`
  hook (`assertSignUpAllowed`, `packages/auth/lib/sign-up-policy.ts`, which
  restates the same live-invite predicate `lib/services/invites.ts` uses,
  since `packages/auth` cannot import the API app), the one place every user
  row goes through regardless of provider. Refusals throw `APIError("FORBIDDEN",
{ code: "SIGNUP_DISABLED" | "SIGNUP_INVITE_REQUIRED" })` with the
  user-facing message, and always emit `auth.sign_up_refused` (target = the
  normalized address); existing accounts are never affected, since the policy
  gates creation only. `GET /config` (`PublicConfig`) reports `signUpMode` and
  `allowedEmailDomains`; the web hides sign-up copy and passes
  `allowSignUp: false` to `continueWithPassword` only in `closed` mode (`invite`
  keeps the sign-up form, since an invited person still has to create an
  account, and shows the invitation notice instead) — a wrong password then
  stays a wrong password instead of falling through to sign-up. The client
  never pre-refuses an address before submitting: an invitation is invisible
  to the browser, so the server owns every refusal, including in `domains`
  mode where the hint under the email field now reads "…, or to invited
  addresses." `/login` never applies this policy, only `/signup`, so an
  existing account whose domain was later removed from the list is not locked
  out.
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
  of the form. `verification: { storeIdentifier: "hashed" }` stores every
  verification/reset/delete-account token as its SHA-256, applied
  symmetrically on write and read, so a leaked database dump cannot be used
  to mint a valid link; upgrading onto this invalidates every such link
  issued beforehand (nothing to migrate — the stale rows simply expire).
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
- GitHub OAuth is optional: `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are
  set together or not at all (a boot error otherwise), and that is the only
  switch — the web shows the button when `GET /config` reports
  `githubLoginEnabled`. `emailVerified` on a GitHub sign-in is whatever GitHub
  itself reports for that address (`@better-auth/core`'s `github.mjs`
  computes it from `/user/emails`); `mapProfileToUser: () => ({ image:
undefined })` only drops the avatar GitHub offers, it does not touch
  verification. An address GitHub reports unverified is therefore neither
  linked into an existing account nor marked verified — it creates its own
  unverified row, gets a verification email, and shows the same
  "unverified" callout a fresh password sign-up would. `account.accountLinking`
  is `{ enabled: true, requireLocalEmailVerified: true }` (no
  `trustedProviders`): an unverified local password account can never be
  silently linked to a GitHub sign-in for the same address, and neither can
  a GitHub address GitHub itself has not verified, so on an
  `EMAIL_TRANSPORT=none` instance an account can never be linked to GitHub by
  address alone — nothing can verify either side.
- Email is optional too. `EMAIL_TRANSPORT` is `none` | `resend` | `smtp`;
  unset it is inferred (`resend` if `RESEND_KEY` is set, else `smtp` if
  `SMTP_URL` is set, else `none`), and naming one explicitly without its
  credential is a boot error. `resolveEmailTransport`
  (`@s3-viewer/email/transport`) is the single implementation, used by the
  API's `lib/env.ts` and by the email package itself. `none` is a first-class
  mode: sign-in still works; emailed verification, password reset and invites
  do not. `GET /config` reports `emailEnabled: false` so the web can say so.
  An operator can inspect then verify a specific account with the console-only
  `verify-email` command (email plus matching account id). Its transaction
  sets `emailVerified`, deletes all sessions and records `account.verify`
  with the account id as target and no acting app user. The operator must
  independently confirm ownership; users then sign in again. There is no
  global verification bypass or public HTTP route.
  The API logs exactly one line at boot naming the mode; with `none`, a
  development instance still prints the whole message (that is how a
  verification link is picked up locally) while production drops it and logs
  only the envelope.
- No profile pictures. Name and email are the whole profile; the avatar is
  generated from the name (`apps/web/lib/utils/avatar.ts`) and is never stored,
  uploaded or editable. The `user.image` column stays because Better Auth's core
  user model declares it, but nothing writes it: `mapProfileToUser` drops
  GitHub's `avatar_url`, `databaseHooks.user.create.before` forces `image: null`,
  and `validateProfile` strips any `image` off an `/update-user` body.
- Cookies: `sameSite: "lax"`, `secure` when `NEXT_PUBLIC_API_URL` is https, `httpOnly`.
  `advanced.ipAddress.disableIpTracking: true`. Session 30 days, refreshed daily.
  Better Auth cookie caching is disabled for every auth endpoint, including
  login-method management. Previously issued cached cookies cannot authorize
  a revoked session. `authGuard` also passes `disableCookieCache: true`.
  Absolute session age is capped at 90 days in both Better Auth hooks and the
  Express guard. Over-age rows are revoked before an auth endpoint can use or
  refresh them; expired cookies are cleared without clearing a new sign-in cookie.
  Neither IP address nor user-agent is stored: `ipAddress` stays a column that
  is always null (Better Auth's own option), while `userAgent` has no column
  at all — nothing ever read it, so it's dropped by a
  `databaseHooks.session.create.before` hook that deletes the field (the
  column no longer exists to null) plus a migration removing it from
  `session`.
- Account deletion: `user.deleteUser` is enabled (`POST /auth/delete-user`) and
  requires `{ expectedUserId, confirmedEmail, password }` (`deleteAccountSchema`)
  checked against the current database session in the shared auth hook,
  including direct HTTP calls. An account with no credential row (GitHub-only)
  fails with `400` `PASSWORD_NOT_SET` ("Set a password in Settings before
  deleting your account.") before Better Auth gets a chance to verify one; a
  wrong password fails `400` `INVALID_PASSWORD`. This closes the gap where a
  stolen, still-logged-in session could delete the account outright. The
  delete dialog has a password field and, for a GitHub-only account, a "Set a
  password first" state linking to the profile page instead of the form.
  `/delete-user/callback` and token-based deletion are disabled. Passwords do not
  bypass the confirmation or freshness requirements. `GET /account/summary`
  includes `user: { id, email }`; the dialog captures this identity and summary,
  disables confirmation during session refresh, and closes on identity changes.
  `session.freshAge` is `SESSION_FRESH_HOURS` (24, `@s3-viewer/types`), which
  the web reads too, so a session older than that is sent to sign in again
  instead of hitting Better Auth's `SESSION_EXPIRED`. `packages/auth` cannot
  import from `apps/api`, so it exposes `onUserDeletion({ beforeDelete,
afterDelete })` and forwards Better Auth's `deleteUser` hooks to whatever is
  registered — `beforeDelete` throws when nothing is, so a user row can never
  vanish without the erasure below. `apps/api/server.ts` registers
  `lib/services/account.ts` at startup. `beforeDelete` runs one Prisma
  transaction that collects the ids of the servers the user owns (stashed per
  user id; stale stashes older than five minutes are dropped so a deletion
  that dies between the hooks cannot accumulate them), deletes
  `PendingInvitation` rows addressed to their email (the cascade misses those:
  they are joined by address, not by id), rewrites every `AuditLog.target`
  equal to their email to `[deleted user]` (`actorId` is kept — it resolves to
  nobody once the row is gone, and the trail must stay intact for the other
  members). That erasure runs before the row goes on purpose: nothing can
  retry it afterwards, and a deletion that fails here leaves an account that
  is merely missing its invites, where one failing after would leave the
  email in the audit trail for good. Better Auth then deletes the user, which
  cascades sessions, accounts, memberships, bucket grants, invitations they
  sent AND every server they own (with all of its members' access and pending
  invites — a server's credentials belong to its owner). `afterDelete`
  invalidates the cached S3 client of every collected server (after the
  cascade, so a racing request cannot refill the cache), records
  `account.delete` with the user as actor (only here, so a `deleteUser` that
  fails after `beforeDelete` leaves no entry claiming a deletion happened)
  and sends `AccountDeletedEmail`; an email failure is logged as `Account
  deletion email failed`, never thrown, because the account is already gone.
- Sign-out immediately clears the session store and cancels and erases queued
  uploads; it clears the react-query cache after the auth request succeeds.
  Account changes and confirmed session expiry also discard queued files.
  Failed sign-out can restore the valid session selection, never old uploads.
- Auth audit events: `@s3-viewer/auth` exports `onAuthEvent((entry: AuditEntry)
=> Promise<void>): void`, registered once from `server.ts` as
  `onAuthEvent(recordAudit)`; a handler failure is caught and logged, never
  failing the auth request. Emitted rows (`serverId` always null):
  `auth.sign_up` (actorId = new user, target = email),
  `auth.sign_up_refused` (no actor, target = email),
  `auth.sign_in` (actorId, target `"password"` or `"github"`),
  `auth.sign_in_failed` (actorId of the existing account the attempt named,
  target `"password"`; a failed attempt against an address with **no**
  account writes nothing at all — the attempted address is never persisted,
  since there would be no reader who could resolve it back to a person),
  `auth.sign_out`, `auth.password_change`, `auth.password_reset` and
  `auth.sessions_revoked` (actorId, no target). `auth.password_set` is the one
  exception, recorded by `POST /account/password` in the API itself rather
  than through this hook. Settings → Profile has a Sessions card
  (`authClient.listSessions/revokeSession/revokeOtherSessions`, the raw
  Better Auth client — no auth-package change needed), which is what drives
  `auth.sessions_revoked`, listing every session newest-first with a
  "This device" badge on the current one, a per-row "Sign out", and a
  card-level "Sign out everywhere else"; and, after it, a Security activity
  card reading `GET /account/audit` 20 rows at a time (`useSecurityActivity`),
  showing the caller's own `auth.*` plus `account.verify` rows (server-scoped
  actions stay in the Share dialog's Activity tab) with relative times and
  the sign-in method, and a "Show more" button while `nextCursor` is set. Both
  cards reuse the `ACTION_LABELS` human-label map from
  `apps/web/components/Share/activity.tsx`.

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
  same `ApiError`. Unauthorized responses are bound to the initiating user,
  so a delayed 401 from a prior account cannot sign out the current account.
- Query keys from `lib/queryKeys.ts`, every key starts with `["user", userId]`;
  `queryClient.clear()` on sign-out. `staleTime` 5 min default;
  `refetchOnWindowFocus: false` for presigned-URL queries.
- `usePermission(permission, bucketName?)` returns a boolean from the current
  server role and the bucket's `userRole`. Storage commands also require the API's
  provider capability flags; upload preflight and cached confirmations recheck
  those flags before enqueueing. Provider limitations appear above the file list.
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
- Delete, folder-delete and rename mutation variables capture userId and
  serverId when the dialog opens. Requests and cache invalidation use that
  captured scope; the API verifies the captured user against the current cookie. Dialogs are hidden immediately on user/server changes;
  stale object row callbacks cannot reopen them for another selection.
  Rename also captures the row or preview's observed ETag when the dialog opens;
  missing or invalid ETags refuse the action. Submission never refreshes that ETag,
  and the API rejects a changed source before copying or deleting anything.
- Loading states are spinners inside containers that already have the final size; skeletons only for large, known-shape areas. Toolbars never swap controls (disable instead).
- Uploads: one `PUT …/objects/v3/upload` per file, streamed through the API into the
  bucket — no bucket configuration needed; `contentType` defaults to
  `application/octet-stream`; 3 files at a time; new files get 2 retries on
  network errors only (never on a 4xx/5xx); replacements are not automatically
  retried; cancel aborts the request; duplicate-key check
  (`POST …/objects/exists`, 1000 keys per call) captures ETags before the
  replacement dialog. Missing ETags refuse replacement and ask for a smaller
  batch. Confirmation never refreshes the snapshot silently. Pending checks
  and replacement dialogs are discarded on user/server changes. Entries use
  a JSON tuple of `[serverId, bucketName, objectKey]`, with independent outcomes
  and completion callbacks across servers. Jobs also retain their initiating
  user, checked before starting and retrying each upload and by the API before
  consuming its body. Identity changes erase files and results; same-user
  navigation preserves uploads. Session synchronization listens directly to
  the auth atom, including during sign-out navigation. Batched key requests (`exists`, `DELETE …/objects/v3`)
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

Served only through the web app. `apps/web/middleware.ts` rewrites the routes
in `LANDING_ROUTES` plus `/landing/*` and `/landing-assets/*` to
`LANDING_ORIGIN`; landing sets `assetPrefix` to `/landing-assets` so every
`/_next/*` URL it emits is fetched from the web app's origin and proxied back.
Landing therefore needs no public origin of its own, and `NEXT_PUBLIC_SITE_URL`
in landing always names the **web app's** origin. Anything landing serves at a
root-relative path that has a file extension (`/logo.svg`, `/icons/*.svg`) is
not rewritten and must exist in `apps/web/public` too — `pnpm favicons`
mirrors that set. The one exception is `/llms.txt`, which the web app rewrites
to landing's `/api/llms` so the guide index is generated from `HOW_TOS` and
`USE_CASES` rather than maintained by hand.

Every how-to has a slug in three places: `HOW_TOS` in
`apps/landing/components/HowTo/data.ts`, a page under
`apps/landing/pages/how-to/`, and `HOW_TO_SLUGS` in `apps/web/lib/site-config.ts`
(the proxy and sitemap). A guide missing from the last one 404s in production.

Only describe what ships (see routes and web notes). No
cross-provider copy, no version browsing, no bulk download,
no side-by-side. Rename is unavailable. Object deletion supports AWS with atomic
ETag conditions and R2 with a stale-object check followed by ordinary key deletion;
the latter can remove a concurrent replacement and must not be called atomic.
Other endpoints refuse object deletion. B2 uploads are blocked
pending verified conditional-write support. Search
is a prefix filter inside the current folder. Share link = 15-minute presigned
URL from the object's "Copy link" action. Uploads stream through the S3 Viewer
server to the bucket (nothing to configure on the bucket); new files retry on
network errors while replacements require review after an uncertain result.
Downloads go straight from the bucket to the browser. Legal pages must
match the README "Data we store" section.
