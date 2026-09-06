# Provider compatibility

S3 Viewer supports AWS S3, Cloudflare R2, and MinIO through their S3 APIs.
Provider names select protocol adaptations; they do not disable basic object
operations. This matrix covers the features exposed by the app.

| App feature                                        | AWS S3              | Cloudflare R2                             | MinIO               |
| -------------------------------------------------- | ------------------- | ----------------------------------------- | ------------------- |
| Connect credentials and select named buckets       | Supported           | Supported, including bucket-scoped tokens | Supported           |
| List and create buckets                            | Supported           | Supported, including R2 pagination        | Supported           |
| Browse folders, paginate objects, filter by prefix | Supported           | Supported                                 | Supported           |
| Read metadata and preview supported file formats   | Supported           | Supported                                 | Supported           |
| Download and generate share URLs                   | Supported           | Supported                                 | Supported           |
| Upload new files and confirm replacements          | Supported           | Supported                                 | Supported           |
| Multipart uploads, progress, and cancellation      | Supported           | Supported                                 | Supported           |
| Rename an object                                   | Supported           | Supported                                 | Supported           |
| Delete one object, a selection, or a folder        | Supported           | Supported                                 | Supported           |
| Team roles and bucket access                       | Enforced by the app | Enforced by the app                       | Enforced by the app |

Versioning is optional. App upload limits still apply (`MAX_UPLOAD_BYTES`,
5 GiB by default), and rename remains limited to 5 GB. A provider can enforce
its own quotas, object locks, credentials, and permissions.

## Protocol differences

Uploads use conditional PUT and multipart publication. New files request an
absent destination; replacements retain the ETag reviewed before confirmation.
R2 and compatible multipart initiation also receive the condition headers.
A condition failure never triggers an unconditional fallback. Cloudflare
explicitly documents conditional initiation and publication in its
[R2 release notes](https://developers.cloudflare.com/r2/platform/release-notes/).
AWS documents [conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html).
Storage writes receive one SDK attempt. The browser can retry a new-file
upload with its absent-key condition, but an uncertain replacement is not
replayed automatically. Multipart abort cleanup retains bounded retries.

Deletion uses one SDK attempt on every provider. AWS adds the reviewed ETag
when available. R2 and generic compatible endpoints use ordinary
`DeleteObjects`, without demanding AWS versioning or unsupported conditional
fields. Missing ETags do not disable deletion. Confirmed per-object failures
can be retried; missing or uncertain results remain visible and require a
fresh review. This addresses lost-response replay without disabling deletion.
See [R2 deletion](https://developers.cloudflare.com/r2/objects/delete-objects/)
and [AWS conditional deletes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-deletes.html).

Rename uses AWS conditional `CopyObject`, R2's
`cf-copy-destination-if-none-match` extension, or conditional server-side
multipart copy on MinIO. The MinIO community release tested here ignores a
CopyObject destination condition, so its rename path uses conditional
multipart completion instead. Source metadata and tags are retained; AWS
object ACL grants and website redirects are preserved where applicable.
Both names are checked before the single-attempt source deletion. The copied
destination is never deleted as rollback. Cloudflare documents its
[copy destination conditions](https://developers.cloudflare.com/r2/api/s3/extensions/#conditional-operations-in-copyobject-for-the-destination-object).
The tested community MinIO release also ignores `DeleteObject`'s `IfMatch`;
only AWS receives that header. R2 and MinIO use ordinary source deletion
after the verification reads.

R2 bucket listings use `cf-next-continuation-token` to advance pages. Its XML
`ContinuationToken` echoes the incoming token. The API and connection probe
share the same paginator, retain named-bucket fallback for scoped credentials,
and report incomplete listings instead of quietly dropping buckets. See
[R2 bucket pagination](https://developers.cloudflare.com/r2/api/s3/extensions/#listbuckets).

Copy followed by deletion cannot atomically coordinate two keys with external
writers. Providers without conditional deletion also cannot atomically compare
a reviewed object before deleting it. ETags identify content and can stay the
same after metadata changes. The app avoids automatic destructive replay;
provider recovery features and application coordination address the remaining
external-writer risks. Unversioned deletion may be permanent.

## Permissions and endpoints

R2 uses its account S3 endpoint and normally region `auto`. Its protocol path
omits unsupported AWS ACL, ownership-control, and versioning requests. Consult
[Cloudflare's compatibility table](https://developers.cloudflare.com/r2/api/s3/api/).

AWS rename needs object read, write, and delete permissions. ACL-enabled
objects also need permissions to read and preserve grants; version-specific
copying needs `s3:GetObjectVersion` and, for versioned ACL snapshots,
`s3:GetObjectVersionAcl`. Current ACL reads and preservation need
`s3:GetObjectAcl` and `s3:PutObjectAcl`. A denied optional ownership-settings
read alone does not disable rename. See the
[AWS permission mapping](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-with-s3-policy-actions.html).

MinIO uses path-style requests and the configured region. Tag-preserving rename
needs object tagging read and write permissions alongside multipart copy and
deletion; versioned tag snapshots may need `s3:GetObjectVersionTagging`.
An endpoint that explicitly reports tagging as unimplemented can still rename
objects without reported tags. Permission failures do not trigger this fallback.
Private or local MinIO deployments require the existing
`ALLOW_PRIVATE_ENDPOINTS=true` setting on a trusted installation. See
[MinIO's supported S3 APIs](https://docs.min.io/aistor/developers/s3-api-compatibility/).

## Verification

Provider-specific tests exercise real AWS SDK serialization, signed R2 copy
and multipart headers, pagination, permission failures, and lost-response
ordering with controlled transports. These tests do not contact cloud buckets.
The opt-in `apps/api/lib/s3/provider.integration.test.ts` exercises real
storage in a newly created disposable bucket and cleans up only that bucket.
It requires `S3_INTEGRATION_ENDPOINT`, `S3_INTEGRATION_ACCESS_KEY`, and
`S3_INTEGRATION_SECRET_KEY`; `S3_INTEGRATION_REGION` is optional. Supply
credentials through the environment, not committed files.

The local integration target is MinIO
`RELEASE.2025-09-07T16-13-09Z`, isolated in a temporary container without
mounted user data. On 2026-09-06, all 11 integration tests passed, covering
bucket creation/listing, small and multipart uploads, unknown-length streams,
create/replace conflicts, an intervening multipart write, cleanup, folder
listing, presigned downloads, metadata/tags, normal and empty-object rename,
destination collisions, and deletion. The disposable buckets, container, and
anonymous volume were removed after testing.

The full automated suite also passed 541 tests; the 11 live integration tests
are opt-in and skipped in the default run. Independent agents reviewed the
final mutation paths and security-relevant changes in the last five commits.
Live AWS and R2 validation remains outstanding: no cloud test target was
provided for this run. Passing transport tests alone is not a claim that a
particular cloud account has been tested.
