# Provider compatibility

S3 Viewer connects through S3 APIs. Protocol compatibility does not imply identical
safety guarantees: an endpoint must enforce the conditions the app sends.

| App feature                                 | AWS S3                                                     | Cloudflare R2                      | Backblaze B2                                | MinIO / other compatible endpoints                |
| ------------------------------------------- | ---------------------------------------------------------- | ---------------------------------- | ------------------------------------------- | ------------------------------------------------- |
| Connect and select named buckets            | Supported                                                  | Supported, including scoped tokens | Custom/derived B2 region supported          | Custom region supported                           |
| List/create buckets                         | Supported                                                  | Supported, including pagination    | S3 API path; live validation pending        | S3 API path                                       |
| Browse, preview, download, share URLs       | Supported                                                  | Supported                          | S3 API path; live validation pending        | S3 API path                                       |
| New-file uploads / multipart / cancellation | Conditional writes                                         | Conditional writes                 | Blocked pending verified conditional writes | Requires provider-enforced conditional writes     |
| Confirmed replacements                      | Preserve readable settings; restrictions below             | Preserve metadata/storage settings | Blocked                                     | Requires readable settings and conditional writes |
| Rename                                      | Reviewed ETag, conditional copy/delete; restrictions below | Blocked before mutation            | Blocked before mutation                     | Blocked before mutation                           |
| Object/selection/folder deletion            | Mandatory reviewed ETag                                    | Blocked before deletion            | Blocked before deletion                     | Blocked before deletion                           |
| Temporary credentials                       | Optional session token supported                           | Optional session token supported   | Ordinary application keys                   | Optional session token, if supported              |
| App team roles and bucket access            | Enforced                                                   | Enforced                           | Enforced                                    | Enforced                                          |

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

Replacement uploads first read the reviewed object and preserve readable ACL
grants, tags, metadata, content type, cache/disposition/language, storage class,
AES256 encryption and explicitly read object-lock attributes. AWS/compatible
replacement checks read bucket lock configuration; enabled locking requires
`GetObjectRetention` and `GetObjectLegalHold`, since HEAD can silently omit those
fields without permission. Unknown or denied locking state blocks the write.
They recheck those settings before PUT or multipart completion. R2 omits
unsupported ACL/tag operations. Denied or
unreadable settings never become permission to reset them to defaults.

The app rejects replacements with missing metadata, content encodings whose
relationship to new local bytes is unknown, or opaque encryption (KMS, DSSE-KMS,
SSE-C). HEAD does not expose the complete KMS encryption context/customer key, so
reusing just the algorithm or key ID could lose a restriction. Upload under a new
name instead. [AWS PUT defaults](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html)
explain why omitted object settings do not carry forward automatically.

B2 uploads stop before reading the body: its conditional-write behavior has not
been verified. Browse/download remains available. Generic endpoints must enforce
conditional publication; successful connection tests alone do not prove that.
App upload limits remain (`MAX_UPLOAD_BYTES`, 5 GiB by default).

## Deletion and rename safety

AWS deletion requires a valid, non-null reviewed ETag for each object and sends
one conditional request. Missing ETags, uncertain outcomes and conflicts remain
visible as nonretryable failures requiring fresh review. The app does not purge
historical versions. [AWS conditional delete documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-deletes.html).

R2 and generic endpoints do not execute object deletion or rename. The prior
HEAD-then-unconditional-DELETE path could erase a concurrent replacement. Another
HEAD check cannot close that race. The operation now stops with an explicit error
and leaves objects intact; unsupported conditions are never silently dropped.

AWS rename carries the ETag captured when the dialog opened, verifies it before
copying, uses an absent-destination condition, preserves readable ACLs/tags and
metadata, and checks both names and tags before conditional source deletion.
Opaque encryption is rejected before copying. The destination is never deleted
as rollback. Rename remains limited to 5 GB.

These checks are not a transaction spanning two keys. External writers can still
change either name after verification, and ETags can remain unchanged when tags,
ACLs or metadata change. Versioning, recovery and coordination of external writers
remain necessary where loss cannot be tolerated. Unversioned AWS deletion can be
permanent; the app does not promise zero data loss under arbitrary concurrency.

## Credentials, regions and permissions

The region field accepts custom values. Blank region derives B2's region from
`s3.<region>.backblazeb2.com`, uses `auto` for R2, or defaults to `us-east-1`.
An explicit value is preserved. [Backblaze's JavaScript setup](https://www.backblaze.com/docs/cloud-storage-use-the-aws-sdk-for-javascript-v3-with-backblaze-b2).

Optional session tokens travel inside the encrypted credential envelope and are
passed to SDK signing and presigned URLs. Legacy key-pair credentials remain valid.
Expired credentials prompt an update; the app does not automatically renew tokens.
A share URL cannot outlive its underlying credentials even if its displayed
signature expiration is later. [AWS temporary credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_use-resources.html)
and [R2 temporary credentials](https://developers.cloudflare.com/r2/api/s3/temporary-credentials/).

AWS rename/replacement needs object reads, writes and tagging reads/writes.
ACL-enabled objects also need permissions to read and preserve grants.
Protection-preserving operations additionally require `s3:GetBucketObjectLockConfiguration`
and, for lock-enabled buckets, `s3:GetObjectRetention` and `s3:GetObjectLegalHold`.
Preserving protection on the new object also requires `s3:PutObjectRetention`
and `s3:PutObjectLegalHold` for the corresponding attributes.
Version-specific snapshots may need `s3:GetObjectVersion`,
`s3:GetObjectVersionAcl` and `s3:GetObjectVersionTagging`. A denied optional
ownership-settings read alone does not disable preservation: the ACL must then
be read. Denied required ACL/tag reads fail safely.

R2 uses its account endpoint and skips unsupported ownership/ACL/tag APIs.
Its bucket paginator follows `cf-next-continuation-token`; named-bucket fallback
remains available for scoped credentials. Other endpoints use path-style requests.
Private endpoints still require `ALLOW_PRIVATE_ENDPOINTS=true` on trusted installs.

## Verification

Automated regressions exercise production implementations with real SDK
serialization and controlled transports: stale reviewed ETags, concurrent writes,
missing conditions, ACL/tag/metadata preservation and permission denial, unsupported
encryption, multipart cleanup, custom regions and encrypted temporary-token
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
rename/deletion. MinIO returns a dummy ACL with no owner identity; replacements
are rejected and tested to leave existing data unchanged. The test bucket and
container were removed. Live AWS, R2 and B2 validation remains outstanding.
