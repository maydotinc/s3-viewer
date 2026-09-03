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
  `@s3-viewer/permissions`. Copy is sentence case. In-progress buttons end with "…".

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
  DELETE_BUCKET / RENAME_SERVER / MANAGE_MEMBERS (admin+), DELETE_SERVER (owner).
- Object permissions are checked against the effective bucket role.

## API (`apps/api`)

### Conventions

- Error envelope, always: `{ message: string, code?: string }` with a proper
  status (400 validation, 401 unauthenticated, 403 forbidden, 404 not found,
  409 conflict, 413 too large, 429 rate limited, 502 upstream S3 failure,
  500 unexpected). Never return raw error messages from AWS/Prisma/Zod.
  Validation returns `code: "VALIDATION"` and a short human message.
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
- Rate limits: global 300/min per IP before auth, then 600/min per user id;
  non-GET `/auth/*` 20/min per IP (Better Auth's own limiter is a no-op with
  `disableIpTracking`, so it is disabled); sign-in emails (`/auth-flow/start`,
  `/auth/email-otp/send-verification-otp`, `/auth/sign-in/magic-link`) share
  5/min per IP, plus 5/10min per email on `/auth-flow/start`; `establish` and
  `validate-buckets` 30/min per user. `TRUST_PROXY` env (default `loopback`)
  feeds `app.set("trust proxy", …)`.
- Parsers: `express.json({ limit: "1mb" })` only, skipped for `PUT …/objects`
  so the upload body reaches the handler as a raw stream. No urlencoded parser.
- Cross-site protection: `sameSite: "lax"` cookies plus an `Origin`/`Sec-Fetch-Site`
  check on every non-GET request, `/auth/*` included (allow only the
  `NEXT_PUBLIC_SITE_URL` origin; a request with neither header is rejected).
- `helmet()` with defaults. CORS origin = `siteOrigin` (`NEXT_PUBLIC_SITE_URL`),
  methods GET/PUT/POST/PATCH/DELETE; allowed headers reflect the preflight
  (cors default), which covers the upload's `Content-Type`.
- S3 clients are cached per server (`lib/s3/client-cache.ts`, TTL 10 min, at
  most 500 entries, keep-alive agent, connect/request timeouts 5s/30s,
  `maxAttempts: 2`), invalidated on server delete. Credentials are decrypted
  once per cache fill. No route changes stored credentials.
- Endpoints are checked on `establish`, `validate-buckets` and `POST /servers`
  after decryption: https only in production, no localhost/private/link-local
  literals, and every DNS answer must be public. The name is resolved once at
  check time; DNS rebinding afterwards is a documented limitation.
- S3 errors map through `lib/s3/errors.ts` (`NoSuchKey`/`NotFound` → 404,
  `AccessDenied` → 403, `NoSuchBucket`/`InvalidBucketName` → 400/404,
  `EntityTooLarge`/`InvalidRequest` copy-size → 413, everything else → 502).
- Presigned URLs (downloads and previews only) expire in 15 minutes. They are
  used as navigations and `<img>`/`<video>`/`<audio>`/`<iframe>` sources, never
  fetched, so buckets need no CORS configuration. Object keys are encoded with
  `encodeURIComponent` per path segment when building `CopySource`.
- Uploads stream through the API (`lib/s3/upload.ts`): `@aws-sdk/lib-storage`
  `Upload` with 25 MiB parts, 4 in flight, `leavePartsOnError: false`; a client
  disconnect aborts the S3 upload. `Content-Length`, when present, is checked
  against `MAX_UPLOAD_BYTES` (413) and passed to S3. The cached client's 30 s
  `requestTimeout` is a socket-idle timeout, so it is fine for the server→S3 leg.
  `server.requestTimeout = 0` and `headersTimeout = 60 s` keep long uploads alive.
- Credential encryption is hybrid: AES-256-GCM payload, key wrapped with
  RSA-OAEP(SHA-256). Wire format (base64 JSON): `{ v: 1, k, iv, ct }`. The
  private key must be at least 2048 bits (checked at startup).

### Routes (all under authGuard except `/auth/*` and `/auth-flow/*`)

```
POST   /auth-flow/start                  { email }            → 204 (sends one email with OTP + magic link)
GET    /servers                                               → { servers: ServerInfo[] }
POST   /servers/establish                establishSchema      → { listBucketsAllowed, bucketCount, provider }
POST   /servers/validate-buckets         validateBucketsSchema→ { results: [{ bucketName, accessible }] }
POST   /servers                          createServerSchema   → { server: ServerInfo }
PATCH  /servers/:serverId                renameServerSchema   → { server: ServerInfo }
DELETE /servers/:serverId                (OWNER)              → 204
POST   /servers/:serverId/leave          (non-owner)          → 204
GET    /servers/:serverId/members        (MANAGE_MEMBERS)     → { members: ServerUser[] }
PATCH  /servers/:serverId/members/:userId updateRoleSchema    → { member: ServerUser }
DELETE /servers/:serverId/members/:userId removeMemberSchema  → 204
GET    /servers/:serverId/invites        (MANAGE_MEMBERS)     → { invites: ServerInvite[] }
POST   /servers/:serverId/invites        sendInviteSchema     → { invites: ServerInvite[], alreadyMembers: string[] }
DELETE /servers/:serverId/invites/:inviteId (MANAGE_MEMBERS, outrank invite role) → 204
GET    /invites                          (received, unexpired)→ { invites: ServerInvite[] }
POST   /invites/:inviteId/accept                              → { server: ServerInfo }
POST   /invites/:inviteId/reject                              → 204
```

`/invites/*` require a verified email (403 `code: "EMAIL_UNVERIFIED"` otherwise):
invites are addressed to an address, and an OAuth provider may hand us an
unverified one. Accepting is atomic; a second concurrent accept gets 404.

```

GET    /servers/:serverId/buckets                             → { buckets: S3Bucket[] }
POST   /servers/:serverId/buckets        { bucketName }       → { bucket: S3Bucket }
DELETE /servers/:serverId/buckets/:bucketName (DELETE_BUCKET; removes from server, DB only) → 204
GET    /servers/:serverId/buckets/:bucketName/objects?prefix&continuationToken&blockSize → S3ObjectListPage
GET    …/objects/metadata?objectKey                           → S3ObjectMetadata
GET    …/objects/download-url?objectKey                       → S3PresignedUrl
GET    …/objects/preview-url?objectKey                        → S3ObjectPreview (content type from HeadObject)
PUT    …/objects?objectKey&contentType   raw body (streamed)  → 201 S3ObjectUploaded `{ key, size, eTag }` (413 over MAX_UPLOAD_BYTES)
DELETE …/objects                         { objectKeys[] }     → S3DeleteResult (207 if any failed)
DELETE …/objects/prefix                  { prefix }           → S3DeleteResult (recursive, paginated; prefix is a folder key ending in "/", never "/" or the root)
POST   …/objects/rename                  { objectKey, newObjectKey } → 204 (409 if target exists, 413 if > 5 GB)
```

Removed on purpose: copy/move routes (no UI), `does-user-exist`, session IP
validation, folder-less single delete (use `objectKeys` with one key), presigned
upload and multipart routes (uploads stream through the API instead, so no
bucket CORS is required).

### Limits

- A listing page makes at most 20 `ListObjectsV2` calls; each follow-up call
  asks only for the rows still missing.
- Recursive prefix delete refuses folders above 100,000 keys (413) before
  deleting anything; use the CLI for larger trees.

### Listing semantics

`GET …/objects` returns folders (common prefixes, `isFolder: true`, key ends
with `/`) first, then objects, and keeps fetching from S3 until at least
`blockSize` rows are collected or the listing ends. `nextToken` is null at the end.

## Auth (`packages/auth`, `apps/api`, `apps/web`)

- One flow for sign-in and sign-up: enter email → we send ONE email containing
  a 6-digit code and a magic link (both valid 10 minutes) → user either types
  the code or clicks the link. New users are created on first successful
  verification; name defaults to the email local part. No name field.
- Implementation: Better Auth `emailOTP` + `magicLink` plugins. `POST /auth-flow/start`
  runs both `auth.api.sendVerificationOTP` and `auth.api.signInMagicLink` inside an
  `AsyncLocalStorage` context; the plugins' send callbacks stash the OTP/URL into
  that context instead of sending; the handler then sends one email
  (`AuthOtpEmail`). Outside the context (direct plugin calls) each callback sends
  its own email. Responses never reveal whether an account exists.
- GitHub OAuth is optional: enabled only when `GITHUB_CLIENT_ID` is set; the web
  shows the button only when `NEXT_PUBLIC_GITHUB_LOGIN_ENABLED=true`.
- Cookies: `sameSite: "lax"`, `secure` when `NEXT_PUBLIC_API_URL` is https, `httpOnly`.
  `advanced.ipAddress.disableIpTracking: true`. Session 30 days, refreshed daily.
- `user.deleteUser` is enabled (`POST /auth/delete-user`, fresh session required).
  Deleting a user cascades through the DB: their sessions, accounts,
  memberships, bucket grants, invitations they sent, AND every server they own
  (with all of its members' access and pending invites). This is intended: a
  server's credentials belong to its owner.
- Sign-out clears the react-query cache and the session store.
- The `/verify` page accepts `?email=` only. The code is never in a URL.
  The magic link is the Better Auth verify URL (`/auth/magic-link/verify?token=…&callbackURL=…`).

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
- Toasts only after the request resolves; never "success" for partial failures.
  Errors show `ApiError.message`.
- Loading states are spinners inside containers that already have the final size; skeletons only for large, known-shape areas. Toolbars never swap controls (disable instead).
- Uploads: one `PUT …/objects` per file, streamed through the API into the
  bucket — no bucket configuration needed; `contentType` defaults to
  `application/octet-stream`; 3 files at a time; 2 retries on network errors
  only (never on a 4xx/5xx); cancel aborts the request; duplicate-key check
  (HEAD) before upload; entries keyed by `bucket/prefix/name`. Downloads and
  previews use 15-minute presigned URLs, which need no CORS.
- Login/signup page: one `AuthScreen` component; mobile = form only, desktop =
  split (form left, brand panel right on Viewer Dark Blue). See
  `packages/ui/BRAND.md`.

## Landing (`apps/landing`)

Only describe what ships (see routes and web notes). No Cmd-K, no
cross-provider copy, no versioning prompts, no bulk download, no audit log,
no side-by-side. Rename refuses to overwrite and is limited to 5 GB. Search
is a prefix filter inside the current folder. Share link = 15-minute presigned
URL from the object's "Copy link" action. Uploads stream through the S3 Viewer
server to the bucket (nothing to configure on the bucket) and retry on network
errors; downloads go straight from the bucket to the browser. Legal pages must
match the README "Data we store" section.
