import {
   AbortMultipartUploadCommand,
   DeleteBucketCommand,
   DeleteObjectsCommand,
   GetObjectCommand,
   HeadObjectCommand,
   ListMultipartUploadsCommand,
   ListObjectsV2Command,
   ListObjectVersionsCommand,
   PutObjectCommand,
   S3Client,
} from "@aws-sdk/client-s3";
import { Provider, backblazeRegion } from "@s3-viewer/types";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectProvider } from "../utils/detect-provider";
import { createNewBucket } from "./bucket-create";
import { listBuckets } from "./bucket-listing";
import { deleteKeys } from "./delete";
import { listKeysPage, listPage } from "./listing";
import { presignedUrl } from "./presign";
import { renameObject } from "./rename";
import { streamUpload } from "./upload";

const endpoint = process.env.S3_INTEGRATION_ENDPOINT;
const isB2 = !!backblazeRegion(endpoint ?? "");
const bucket = `s3-viewer-integration-${randomUUID()}`;
const MIB = 1024 * 1024;

describe.skipIf(!endpoint)(
   "S3 provider integration in a disposable bucket",
   () => {
      let client: S3Client;
      let created = false;
      const scope = () => ({
         client,
         bucket,
         signal: AbortSignal.timeout(30_000),
      });
      const put = (key: string, data: string) =>
         client.send(
            new PutObjectCommand({ Bucket: bucket, Key: key, Body: data })
         );
      const read = async (key: string) => {
         const out = await client.send(
            new GetObjectCommand({ Bucket: bucket, Key: key })
         );
         return Buffer.from(await out.Body!.transformToByteArray());
      };
      const renameReviewed = async (key: string, destination: string) => {
         const reviewed = await client.send(
            new HeadObjectCommand({ Bucket: bucket, Key: key })
         );
         expect(reviewed.ETag).toBeTruthy();
         return renameObject(scope(), key, destination, reviewed.ETag!);
      };
      const upload = (
         key: string,
         data: Buffer,
         expectedETag?: string,
         unknownLength = false
      ) =>
         streamUpload({
            client,
            bucket,
            key,
            expectedETag,
            body: Readable.from([data]),
            contentType: "application/octet-stream",
            contentLength: unknownLength ? undefined : data.byteLength,
            partSize: 5 * MIB,
            maxBytes: 10 * MIB,
            abortController: new AbortController(),
         });

      beforeAll(async () => {
         if (!endpoint) return;
         const accessKeyId = process.env.S3_INTEGRATION_ACCESS_KEY;
         const secretAccessKey = process.env.S3_INTEGRATION_SECRET_KEY;
         if (!accessKeyId || !secretAccessKey)
            throw new Error(
               "Integration tests require explicit test storage credentials"
            );
         client = new S3Client({
            endpoint,
            region: process.env.S3_INTEGRATION_REGION ?? "us-east-1",
            forcePathStyle: true,
            credentials: {
               accessKeyId,
               secretAccessKey,
               sessionToken: process.env.S3_INTEGRATION_SESSION_TOKEN,
            },
            requestChecksumCalculation:
               detectProvider(endpoint) === Provider.R2
                  ? "WHEN_REQUIRED"
                  : "WHEN_SUPPORTED",
            maxAttempts: 2,
         });
         await createNewBucket(
            client,
            detectProvider(endpoint),
            bucket,
            AbortSignal.timeout(30_000)
         );
         created = true;
      }, 30_000);

      afterAll(async () => {
         if (!created) {
            client?.destroy();
            return;
         }
         try {
            const incomplete = await client.send(
               new ListMultipartUploadsCommand({ Bucket: bucket })
            );
            for (const entry of incomplete.Uploads ?? []) {
               await client.send(
                  new AbortMultipartUploadCommand({
                     Bucket: bucket,
                     Key: entry.Key,
                     UploadId: entry.UploadId,
                  })
               );
            }
            // B2 writes are versioned by default. Key-only deletes merely
            // create delete markers, leaving a nonempty disposable bucket.
            if (isB2) {
               for (;;) {
                  const versions = await client.send(
                     new ListObjectVersionsCommand({ Bucket: bucket })
                  );
                  const objects = [
                     ...(versions.Versions ?? []),
                     ...(versions.DeleteMarkers ?? []),
                  ].map((entry) => {
                     if (!entry.Key || !entry.VersionId)
                        throw new Error(
                           "Storage returned an incomplete test object version"
                        );
                     return { Key: entry.Key, VersionId: entry.VersionId };
                  });
                  if (!objects.length) {
                     if (versions.IsTruncated)
                        throw new Error(
                           "Storage returned an incomplete version listing"
                        );
                     break;
                  }
                  const removed = await client.send(
                     new DeleteObjectsCommand({
                        Bucket: bucket,
                        Delete: { Objects: objects },
                     })
                  );
                  if (removed.Errors?.length)
                     throw new Error(
                        "Could not remove disposable test object versions"
                     );
               }
            }
            for (;;) {
               const page = await client.send(
                  new ListObjectsV2Command({ Bucket: bucket })
               );
               const objects = (page.Contents ?? []).flatMap((entry) =>
                  entry.Key ? [{ Key: entry.Key }] : []
               );
               if (!objects.length) break;
               const removed = await client.send(
                  new DeleteObjectsCommand({
                     Bucket: bucket,
                     Delete: { Objects: objects },
                  })
               );
               if (removed.Errors?.length)
                  throw new Error(
                     "Disposable integration bucket cleanup failed"
                  );
            }
            await client.send(new DeleteBucketCommand({ Bucket: bucket }));
         } finally {
            client.destroy();
         }
      }, 30_000);

      it("creates and lists the test bucket and rejects creating it again", async () => {
         const buckets = await listBuckets(client, AbortSignal.timeout(30_000));
         expect(buckets.some((entry) => entry.Name === bucket)).toBe(true);
         await expect(
            createNewBucket(
               client,
               detectProvider(endpoint!),
               bucket,
               AbortSignal.timeout(30_000)
            )
         ).rejects.toMatchObject({ status: 409 });
      });

      it.each([32, 6 * MIB])(
         "uploads and verifies all %i bytes using the real provider",
         async (size) => {
            const data = Buffer.alloc(size, 41);
            const key = `uploads/${size}`;
            if (isB2) {
               await expect(upload(key, data)).rejects.toMatchObject({
                  status: 409,
                  message: expect.stringContaining("Backblaze B2"),
               });
               await expect(read(key)).rejects.toMatchObject({
                  name: "NoSuchKey",
               });
               return;
            }
            const result = await upload(key, data);
            expect(result.size).toBe(size);
            expect(result.eTag).toBeTruthy();
            expect(await read(key)).toEqual(data);
            if (size > 5 * MIB) expect(result.eTag).toMatch(/-2"$/);
         },
         30_000
      );

      it("uploads an unknown-length multipart stream", async () => {
         const data = Buffer.alloc(6 * MIB, 71);
         if (isB2) {
            await expect(
               upload("unknown-length", data, undefined, true)
            ).rejects.toMatchObject({
               status: 409,
               message: expect.stringContaining("Backblaze B2"),
            });
            await expect(read("unknown-length")).rejects.toMatchObject({
               name: "NoSuchKey",
            });
            return;
         }
         expect(
            await upload("unknown-length", data, undefined, true)
         ).toMatchObject({ size: data.length });
         expect(await read("unknown-length")).toEqual(data);
      }, 30_000);

      it.each([32, 6 * MIB])(
         "preserves existing and intervening data during %i-byte create/replace conflicts",
         async (size) => {
            const key = `conflicts/${size}`;
            const original = await put(key, "original-data");
            const data = Buffer.alloc(size, 19);
            await expect(upload(key, data)).rejects.toMatchObject({
               status: 409,
            });
            expect((await read(key)).toString()).toBe("original-data");
            await put(key, "another-writer");
            await expect(
               upload(key, data, original.ETag)
            ).rejects.toMatchObject({ status: 409 });
            expect((await read(key)).toString()).toBe("another-writer");
            const current = await client.send(
               new HeadObjectCommand({ Bucket: bucket, Key: key })
            );
            if (isB2) {
               await expect(
                  upload(key, data, current.ETag)
               ).rejects.toMatchObject({
                  status: 409,
                  message: expect.stringContaining("Backblaze B2"),
               });
               expect((await read(key)).toString()).toBe("another-writer");
               return;
            }
            if (detectProvider(endpoint!) !== Provider.R2) {
               await expect(
                  upload(key, data, current.ETag)
               ).rejects.toMatchObject({ status: 409 });
               expect((await read(key)).toString()).toBe("another-writer");
               return;
            }
            await upload(key, data, current.ETag);
            expect(await read(key)).toEqual(data);
         },
         30_000
      );

      it("checks multipart conditions again after an intervening write during UploadPart", async () => {
         const key = "intervening-multipart";
         let changed = false;
         const handler = client.config.requestHandler;
         const isolated = new S3Client({
            ...client.config,
            retryStrategy: undefined,
            serviceConfiguredEndpoint: undefined,
            requestHandler: {
               handle: async (...args: Parameters<typeof handler.handle>) => {
                  const result = await handler.handle(...args);
                  if (args[0].query.partNumber && !changed) {
                     changed = true;
                     await put(key, "external-change-during-upload");
                  }
                  return result;
               },
            },
         });
         await expect(
            streamUpload({
               client: isolated,
               bucket,
               key,
               body: Readable.from([Buffer.alloc(6 * MIB)]),
               contentType: "application/octet-stream",
               contentLength: 6 * MIB,
               partSize: 5 * MIB,
               maxBytes: 10 * MIB,
               abortController: new AbortController(),
            })
         ).rejects.toMatchObject({ status: 409 });
         if (isB2) {
            expect(changed).toBe(false);
            await expect(read(key)).rejects.toMatchObject({
               name: "NoSuchKey",
            });
            return;
         }
         expect(changed).toBe(true);
         expect((await read(key)).toString()).toBe(
            "external-change-during-upload"
         );
         const incomplete = await client.send(
            new ListMultipartUploadsCommand({ Bucket: bucket, Prefix: key })
         );
         expect(incomplete.Uploads ?? []).toHaveLength(0);
      }, 30_000);

      it("lists folders and objects with ETags and downloads through a presigned URL", async () => {
         await put("folder/one.txt", "download-body");
         await put("folder/deep/two.txt", "nested");
         const page = await listPage({
            ...scope(),
            prefix: "folder/",
            blockSize: 100,
         });
         expect(page.objects).toEqual(
            expect.arrayContaining([
               expect.objectContaining({ key: "folder/deep/", isFolder: true }),
               expect.objectContaining({
                  key: "folder/one.txt",
                  eTag: expect.any(String),
                  size: 13,
               }),
            ])
         );
         const recursive = await listKeysPage(scope(), "folder/", undefined);
         expect(recursive.objects.map((entry) => entry.key)).toEqual([
            "folder/deep/two.txt",
            "folder/one.txt",
         ]);
         const signed = await presignedUrl(
            client,
            new GetObjectCommand({ Bucket: bucket, Key: "folder/one.txt" })
         );
         const download = await fetch(signed.url);
         expect(download.status).toBe(200);
         expect(await download.text()).toBe("download-body");
      });

      it("refuses rename while retaining the source bytes and metadata", async () => {
         await client.send(
            new PutObjectCommand({
               Bucket: bucket,
               Key: "rename/source.txt",
               Body: "rename-body",
               ContentType: "text/plain",
               CacheControl: "max-age=3600",
               ContentDisposition: "attachment",
               Metadata: { purpose: "provider-integration" },
               ...(detectProvider(endpoint!) === Provider.R2 || isB2
                  ? {}
                  : { Tagging: "test=preserve" }),
            })
         );
         await expect(
            renameReviewed("rename/source.txt", "rename/result.txt")
         ).rejects.toMatchObject({ status: 409 });
         expect((await read("rename/source.txt")).toString()).toBe(
            "rename-body"
         );
         await expect(read("rename/result.txt")).rejects.toMatchObject({
            name: "NoSuchKey",
         });
         const metadata = await client.send(
            new HeadObjectCommand({ Bucket: bucket, Key: "rename/source.txt" })
         );
         expect(metadata).toMatchObject({
            ContentType: "text/plain",
            CacheControl: "max-age=3600",
            ContentDisposition: "attachment",
            Metadata: { purpose: "provider-integration" },
         });
         await put("rename/occupied.txt", "keep-destination");
         await expect(
            renameReviewed("rename/source.txt", "rename/occupied.txt")
         ).rejects.toMatchObject({ status: 409 });
         expect((await read("rename/occupied.txt")).toString()).toBe(
            "keep-destination"
         );
         expect((await read("rename/source.txt")).toString()).toBe(
            "rename-body"
         );
      }, 30_000);

      it("refuses empty-object rename without changing either filename", async () => {
         await put("empty/source", "");
         await put("empty/occupied", "keep-destination");
         await expect(
            renameReviewed("empty/source", "empty/occupied")
         ).rejects.toMatchObject({ status: 409 });
         expect((await read("empty/occupied")).toString()).toBe(
            "keep-destination"
         );
         expect(await read("empty/source")).toHaveLength(0);
         await expect(
            renameReviewed("empty/source", "empty/result")
         ).rejects.toMatchObject({ status: 409 });
         expect(await read("empty/source")).toHaveLength(0);
         await expect(read("empty/result")).rejects.toMatchObject({
            name: "NoSuchKey",
         });
      }, 30_000);

      it("deletes selected objects and the recursively listed contents of a folder", async () => {
         await put("deletion/one", "one");
         await put("deletion/deep/two", "two");
         const keys = await listKeysPage(scope(), "deletion/", undefined);
         const result = await deleteKeys(scope(), keys.objects);
         if (![Provider.S3, Provider.R2].includes(detectProvider(endpoint!))) {
            expect(result.deleted).toEqual([]);
            expect(result.failed).toHaveLength(keys.objects.length);
            expect(result.failed.every(({ retryable }) => !retryable)).toBe(
               true
            );
            expect((await read("deletion/one")).toString()).toBe("one");
            expect((await read("deletion/deep/two")).toString()).toBe("two");
            return;
         }
         expect(result.failed).toEqual([]);
         expect(result.deleted.sort()).toEqual([
            "deletion/deep/two",
            "deletion/one",
         ]);
         expect(
            (await listKeysPage(scope(), "deletion/", undefined)).objects
         ).toEqual([]);
      });
   }
);
