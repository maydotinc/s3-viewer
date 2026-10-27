import type { HeadObjectCommandOutput } from "@aws-sdk/client-s3";
import { Role } from "@s3-viewer/shared";
import { describe, expect, it } from "vitest";
import { toSettings } from "./head";

const head: HeadObjectCommandOutput = {
   $metadata: {},
   ContentType: "text/csv",
   ContentLength: 42,
   LastModified: new Date("2026-01-02T03:04:05.000Z"),
   StorageClass: "STANDARD",
   ETag: '"e1"',
   CacheControl: "max-age=60",
   ContentDisposition: "inline",
   ContentEncoding: "gzip",
   ContentLanguage: "en",
   Expires: new Date("2026-10-21T07:28:00.000Z"),
   Metadata: { owner: "finance" },
   ServerSideEncryption: "aws:kms",
   SSEKMSKeyId: "arn:aws:kms:us-east-1:123456789012:key/abc",
   VersionId: "v1",
};

describe("toSettings", () => {
   it.each([Role.EDITOR, Role.ADMIN, Role.OWNER])(
      "returns everything to %s",
      (role) => {
         expect(toSettings(head, role)).toMatchObject({
            cacheControl: "max-age=60",
            contentDisposition: "inline",
            contentLanguage: "en",
            expires: "2026-10-21T07:28:00.000Z",
            metadata: { owner: "finance" },
            serverSideEncryption: "aws:kms",
            sseKmsKeyId: "arn:aws:kms:us-east-1:123456789012:key/abc",
            versionId: "v1",
         });
      }
   );

   it.each([Role.VIEWER, null])(
      "keeps the metadata and the same keys for %s",
      (role) => {
         const settings = toSettings(head, role);
         expect(settings).toEqual({
            contentType: "text/csv",
            contentLength: 42,
            lastModified: "2026-01-02T03:04:05.000Z",
            storageClass: "STANDARD",
            eTag: '"e1"',
            contentEncoding: "gzip",
            cacheControl: null,
            contentDisposition: null,
            contentLanguage: null,
            expires: null,
            metadata: {},
            serverSideEncryption: null,
            sseKmsKeyId: null,
            versionId: null,
         });
         expect(Object.keys(settings).sort()).toEqual(
            Object.keys(toSettings(head, Role.OWNER)).sort()
         );
      }
   );
});
