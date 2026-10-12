export const ILLUSTRATION_LABELS = {
   accessDenied:
      "A 403 AccessDenied error for a GetObject request, next to the IAM, bucket policy and other checks S3 evaluates together; one explicit deny overrides every allow.",
   createFolder:
      "Creating a folder in S3 Viewer by dropping a file into it, next to the flat list of keys S3 actually stores, where folders are just shared prefixes.",
   delete:
      "Three selected objects in a bucket and a confirmation dialog to delete them, noting that versioning keeps older versions recoverable.",
   download:
      "Downloading report-2026-09.pdf from S3 Viewer: the file keeps its own filename and the access keys never reach the browser.",
   iamReadOnly:
      "A read-only IAM policy for one bucket next to the S3 Viewer connect form, where keys that cannot list buckets name the bucket they can read.",
   invite:
      "Inviting dana@acme.com to the media-archive bucket as an Editor, with no IAM user or access keys and one-click revoke.",
   permissions:
      "Roles assigned per folder prefix in the media-archive bucket, next to the IAM bucket policy condition that scopes access to a prefix.",
   rename:
      "Renaming report-final.pdf to report-2026-09.pdf in S3 Viewer, done under the hood as a CopyObject to the new key followed by a DeleteObject of the old one.",
   search:
      "Filtering a bucket by the prefix invoice-2026: three of six objects match.",
   shareLink:
      "Copying a 15-minute, read-only presigned link to q3-report.pdf that the recipient can open without an account.",
   sideBySide:
      "AWS S3 and Cloudflare R2 buckets shown side by side, one credential per provider and one click apart.",
   switchBuckets:
      "The S3 Viewer sidebar with servers and buckets, and a command palette that jumps to any bucket by typing part of its name.",
   upload:
      "Dropping an 80 MB file to upload it: S3 Viewer streams it through its server as a multipart upload, shown 62% complete.",
   cloudflareR2:
      "A Cloudflare R2 server connected to S3 Viewer through its S3-compatible endpoint with no code changes, listing four buckets.",
   multiCloud:
      "Three servers on Cloudflare R2, Amazon S3 and MinIO in one sidebar, with the active R2 server's buckets listed beside them.",
   s3Browser:
      "Objects in a bucket with a row menu open, offering Rename, Copy link, Download and Delete.",
   security:
      "The connect form encrypting access keys in the browser before they are sent to the server, alongside MIT license, self-hostable and zero object retention.",
   shareNonTechnical:
      "A client invited to view the client-deliverables bucket with a read-only Viewer role and no AWS account, and the owner revoking access in one click.",
   teams: "The members list for the media-archive bucket with three members and a pending invite, each with their own role and no per-person IAM users.",
} as const;
