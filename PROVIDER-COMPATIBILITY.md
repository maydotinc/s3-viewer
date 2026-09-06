# Provider compatibility

S3 Viewer connects through S3 APIs. Protocol compatibility does not imply identical
safety guarantees: an endpoint must enforce the conditions the app sends.

| App feature                                 | AWS S3                                    | Cloudflare R2                             | Backblaze B2                                | MinIO / other compatible endpoints            |
| ------------------------------------------- | ----------------------------------------- | ----------------------------------------- | ------------------------------------------- | --------------------------------------------- |
| Connect and select named buckets            | Supported                                 | Supported, including scoped tokens        | Custom/derived B2 region supported          | Custom region supported                       |
| List/create buckets                         | Supported                                 | Supported, including pagination           | S3 API path; live validation pending        | S3 API path                                   |
| Browse, preview, download, share URLs       | Supported                                 | Supported                                 | S3 API path; live validation pending        | S3 API path                                   |
| New-file uploads / multipart / cancellation | Conditional writes                        | Conditional writes                        | Blocked pending verified conditional writes | Requires provider-enforced conditional writes |
| Confirmed replacements                      | Blocked: mutable ACL/tag permission races | Preserve metadata/storage settings        | Blocked                                     | Blocked: mutable ACL/tag permission races     |
| Rename                                      | Blocked before mutation                   | Blocked before mutation                   | Blocked before mutation                     | Blocked before mutation                       |
| Object/selection/folder deletion            | Atomic ETag condition                     | Supported; stale check, then key deletion | Blocked before deletion                     | Blocked before deletion                       |
| Temporary credentials                       | Optional session token supported          | Optional session token supported          | Ordinary application keys                   | Optional session token, if supported          |
| App team roles and bucket access            | Enforced                                  | Enforced                                  | Enforced                                    | Enforced                                      |

"Supported" describes implementation and protocol evidence, not a claim that a
particular live cloud account has been tested. See verification below. Bucket
creation/deletion still requires provider permission and follows provider rules.

## Uploads and replacements

New files send `If-None-Match: *`; replacements send the ETag reviewed before
confirmation in `If-Match`. PUT and multipart publication retain those conditions,
including R2 initiation headers. Conflicts never cause unconditional fallback.
Writes get one SDK attempt. New-file browser retries retain the absent-key
condition; uncertain replacements require fresh review. Cleanup has bounded retries.
See [AWS conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html)
and [R2 conditional writes](https://developers.cloudflare.com/r2/platform/release-notes/).

AWS and other compatible endpoints refuse replacements before reading the upload
body or contacting storage. ETags cover object content, not mutable ACLs or tags.
Replaying a previously public ACL or tag can undo a concurrent revocation,
including bucket-policy restrictions based on `s3:ExistingObjectTag`. Disabled
ACLs alone do not close tag-based permission races, and dropping tags can loosen
deny-by-tag policies. Additional reads cannot make these changes atomic.
Upload under a new filename instead. The app does not change bucket settings.

R2 supports confirmed replacements because its S3 API does not expose object ACLs
or object tags. It preserves readable metadata, content type,
cache/disposition/language and storage class, then checks those settings before
PUT or multipart completion. R2 receives no unsupported ACL/tag operations.
Replacements with missing metadata, opaque encryption (KMS, DSSE-KMS, SSE-C),
or content encodings whose relationship to new local bytes is unknown are refused.
[AWS object tag policies](https://docs.aws.amazon.com/AmazonS3/latest/userguide/tagging-and-policies.html)
and [R2 S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/).

B2 uploads stop before reading the body: its conditional-write behavior has not
been verified. Browse/download remains available. Generic endpoints must enforce
conditional publication; successful connection tests alone do not prove that.
App upload limits remain (`MAX_UPLOAD_BYTES`, 5 GiB by default).

## Deletion and rename safety

AWS deletion requires a valid, non-null reviewed ETag for each object and sends
one conditional request. Missing ETags, uncertain outcomes and conflicts remain
visible as nonretryable failures requiring fresh review. The app does not purge
historical versions. [AWS conditional delete documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-deletes.html).

R2 supports single-object, selection and folder deletion. For each reviewed key,
the app checks `HeadObject` with `If-Match`, verifies the returned ETag, and then
sends one ordinary `DeleteObject` request. Already-changed objects are refused;
missing objects need no DELETE. Failures are reported per key and uncertain
delete outcomes cannot be replayed from the confirmation dialog. Work is bounded
and cancellation stops new requests.

This is **key deletion, not atomic version-conditional deletion**. R2's documented
S3 API supports deletion but does not promise an ETag condition on DELETE. A
different writer can replace the object between the check and deletion, and that
replacement can be removed. Pause writes to those names while deleting. The
existing confirmation explains this limit and permanence, without adding a
separate approval step. See [R2 deletion](https://developers.cloudflare.com/r2/objects/delete-objects/)
and [R2 S3 API support](https://developers.cloudflare.com/r2/api/s3/api/).

B2 and generic endpoints still refuse object deletion. No provider silently
falls back from a rejected conditional request to unconditional deletion.

Rename is unavailable on every provider and its API returns an explicit conflict
before making any storage request. Copy/delete cannot atomically protect two
filenames or concurrent permission changes. Versioning can preserve an original
copy, but it cannot prevent a copied object retaining access that another writer
revoked on the source. The app therefore performs neither step. Download and
upload under a new filename if a separately created object is intended.

Explicit unversioned AWS deletion can be permanent. ETags can remain unchanged
when metadata or tags change, so versioning/backups and coordination with external
writers remain necessary where loss cannot be tolerated. The app does not promise
zero data loss under arbitrary concurrency.

## Credentials, regions and permissions

The region field accepts custom values. Blank region derives B2's region from
`s3.<region>.backblazeb2.com`, uses `auto` for R2, or defaults to `us-east-1`.
An explicit value is preserved. [Backblaze's JavaScript setup](https://www.backblaze.com/docs/cloud-storage-use-the-aws-sdk-for-javascript-v3-with-backblaze-b2).

For AWS, each bucket's region is discovered before requests or URL signing,
including when `HeadBucket` returns a region with a permission-denied response.
Regional clients expire after ten minutes and are invalidated when connection
credentials change or are removed. R2 and B2 retain their configured endpoints.

Optional session tokens travel inside the encrypted credential envelope and are
passed to SDK signing and presigned URLs. Legacy key-pair credentials remain valid.
Expired credentials prompt an update; the app does not automatically renew tokens.
A share URL cannot outlive its underlying credentials even if its displayed
signature expiration is later. [AWS temporary credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_use-resources.html)
and [R2 temporary credentials](https://developers.cloudflare.com/r2/api/s3/temporary-credentials/).

Blocked rename/replacement operations need no additional bucket ownership,
versioning, ACL, tagging or object-lock permissions; the app sends no storage
requests for those operations. Normal browse/upload/delete operations still
require the corresponding provider permissions. AWS new uploads remain
conditional on the destination being absent.

The API supplies capability flags with each connection. The web app combines
those flags with team permissions, explains provider restrictions, and disables
unsupported actions. Missing capability data disables mutations; upload
confirmation rechecks replacement availability before any file is queued.

R2 uses its account endpoint and skips unsupported ownership/ACL/tag APIs.
Its bucket paginator follows `cf-next-continuation-token`; named-bucket fallback
remains available for scoped credentials. Other endpoints use path-style requests.
Private endpoints still require `ALLOW_PRIVATE_ENDPOINTS=true` on trusted installs.

## Verification

Automated regressions exercise production implementations with real SDK
serialization and controlled transports: stale reviewed ETags, concurrent writes,
missing conditions, R2 deletion success/stale failures/lost responses, non-mutating refusal of unsafe ACL/tag operations, R2 metadata
preservation, unsupported encryption, multipart cleanup, custom regions and encrypted temporary-token
roundtrips through request and presign signing.

`apps/api/lib/s3/provider.integration.test.ts` is opt-in and creates a disposable
bucket. It requires `S3_INTEGRATION_ENDPOINT`, `S3_INTEGRATION_ACCESS_KEY` and
`S3_INTEGRATION_SECRET_KEY`; `S3_INTEGRATION_REGION` is optional. Credentials belong
in environment variables, not committed files. Its cleanup touches only that
newly created bucket. It now verifies that unsupported rename/delete leave data
intact, as well as supported upload/read behavior.

All 11 integration tests passed against disposable MinIO
`RELEASE.2025-09-07T16-13-09Z` on 2026-09-06, using a memory-only container with
no user data mounted. This covered new small/multipart/unknown-length uploads,
conflicts and cleanup, listing/presigned reads, and non-mutating refusal of unsafe
rename/deletion. Compatible-endpoint replacements
are rejected and tested to leave existing data unchanged. The test bucket and
container were removed. Live AWS, R2 and B2 validation remains outstanding.
