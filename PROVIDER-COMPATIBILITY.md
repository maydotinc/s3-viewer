# provider compatibility

connect AWS S3, Cloudflare R2, Backblaze B2, or another S3-compatible endpoint like
MinIO. here's what s3 viewer supports. your storage permissions and app role need
to allow it too.

✅ supported · ⚠️ supported with limits · ❌ not available in s3 viewer

compatible endpoints need the relevant S3 APIs. support isn't a guarantee for
every provider or setup.

| feature                                   | s3 viewer                                                             | AWS S3         | Cloudflare R2                             | B2 / other compatible endpoints |
| ----------------------------------------- | --------------------------------------------------------------------- | -------------- | ----------------------------------------- | ------------------------------- |
| create buckets                            | ✅                                                                    | ✅             | ✅                                        | ⚠️ needs `CreateBucket`         |
| delete buckets from storage               | ❌ (intentional, too destructive to have in s3-viewer in our opinion) | —              | —                                         | —                               |
| browse, preview, download and share links | ✅                                                                    | ✅             | ✅                                        | ✅                              |
| upload and replace                        | ✅                                                                    | ✅ conditional | ✅ conditional                            | ⚠️ checked                      |
| delete objects                            | ✅                                                                    | ✅ conditional | ⚠️ checked                                | ⚠️ checked                      |
| copy, rename and move                     | ✅                                                                    | ✅             | ⚠️ up to 5 GiB per object                 | ⚠️ conditions vary by provider  |
| edit headers and metadata                 | ✅                                                                    | ✅             | ⚠️ up to 5 GiB per object                 | ⚠️ conditions vary by provider  |
| edit text files                           | ✅ up to 1 MiB                                                        | ✅ conditional | ✅ conditional                            | ⚠️ checked                      |
| transfer between buckets and servers      | ✅ streamed through the API between servers                           | ✅             | ⚠️ up to 5 GiB per object within a server | ⚠️ checked                      |
| download as zip                           | ✅                                                                    | ✅             | ✅                                        | ✅                              |
| list and abort incomplete uploads         | ✅                                                                    | ✅             | ✅                                        | ⚠️ needs multipart APIs         |

## a few things to know

- **buckets:** **Remove bucket** takes a bucket off a server's allow-list for
  every member and clears its grants. the bucket and its objects stay in
  storage. it's only available on servers limited to specific buckets, and not
  for the last one.
- **concurrent changes:** conditional requests ask storage to enforce an ETag or
  an absent destination. checked operations use a HEAD request first, so another
  writer can still change the object before the write or delete. s3 viewer uses
  this fallback for B2 and unknown endpoints, and on R2 for deletes, including
  the delete step of renames and moves. failed or forbidden HEAD requests don't
  count as missing objects.
- **deletes:** a supplied ETag is checked. without one, AWS uses the ETag fetched
  just before deletion; other endpoints confirm the object with a HEAD request,
  then delete it without a condition. objects that are already gone count as
  deleted.
- **rename and move:** copy first, then delete. if deletion fails, the copy stays
  and the app tells you what happened. bulk and folder operations can also
  partially succeed. S3's native `RenameObject` only works on S3 Express One
  Zone directory buckets, which s3 viewer doesn't support, so it isn't used.
- **R2:** the app refuses server-side copies, renames, moves and metadata changes
  above 5 GiB, including transfers between buckets on the same server. other
  providers copy larger objects in parts. R2 has no object tags or ACLs, so
  they aren't carried over.
- **limits:** on every provider, uploads and transfers between servers follow
  your instance's upload limit (5 GiB by default). zip downloads are limited to
  10,000 objects and 10 GiB by default, and stop if they run too slowly. see
  [configuration](./SELF-HOSTING.md#configuration).
- **settings and encryption:** replacements keep metadata and supported headers;
  tags and ACLs are best effort. in-place AWS settings changes need readable ACLs,
  and multipart settings changes need readable tags. copies, replacements and
  transfers using customer-provided encryption keys are refused.
- **unusual keys:** existing keys keep their exact spelling. keys containing `.`
  or `..` path segments can't have a browser link. only the server owner can
  download them, using **Download as zip**. zip entry names are sanitized;
  storage keys stay unchanged. new names, text edits and replacements follow
  the app's stricter naming rules. header and metadata edits work on the
  existing key as-is.

## connecting

- use the provider's **S3 API endpoint**. AWS and R2 are detected from their
  service hostnames, and B2 from its `s3.<region>.backblazeb2.com` endpoint.
  other endpoints, including custom domains in front of S3 or R2, use the
  generic compatibility path.
- leave the region blank to use `auto` for R2, the endpoint's region for B2, or
  `us-east-1` otherwise. AWS bucket regions are discovered automatically.
- no `ListBuckets` permission? enter up to 100 bucket names when connecting.
- temporary credentials work with a session token. update them when they expire;
  s3 viewer doesn't renew them. share links last 15 minutes, or less if temporary
  credentials expire sooner.
- production defaults to public HTTPS endpoints. for private storage or HTTP,
  set `ALLOW_PRIVATE_ENDPOINTS=true` on a trusted instance. see
  [self-hosting](./SELF-HOSTING.md#private-storage-endpoints).

## what's tested

unit tests cover request conditions, stale ETags, partial failures, multipart
cleanup and provider-specific limits. `pnpm test:distribution` builds and boots
the production images and runs the provider suite against disposable RustFS
storage. it needs Docker. see [distribution validation](./RELEASE-VALIDATION.md).

to test your own endpoint, run
`pnpm exec vitest run apps/api/lib/s3/provider.integration.test.ts` with
`S3_INTEGRATION_ENDPOINT`, `S3_INTEGRATION_ACCESS_KEY` and
`S3_INTEGRATION_SECRET_KEY` set. region and session token are optional via
`S3_INTEGRATION_REGION` and `S3_INTEGRATION_SESSION_TOKEN`. the region defaults
to `us-east-1` and isn't discovered automatically, so set it for AWS buckets
elsewhere. the suite creates and removes two disposable buckets, so use test
credentials that allow that.

RustFS results don't verify AWS, R2, B2 or MinIO behavior. R2 conditional multipart
completion still needs testing against the actual deployment.
