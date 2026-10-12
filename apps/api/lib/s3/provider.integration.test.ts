import {
   AbortMultipartUploadCommand,
   CreateMultipartUploadCommand,
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
import { MIB, Provider, backblazeRegion } from "@s3-viewer/types";
import { randomUUID } from "node:crypto";
import { Readable, Writable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectProvider } from "@/lib/utils/detect-provider";
import { collectArchiveEntries } from "./archive/entries";
import { streamArchive } from "./archive/stream";
import { createNewBucket } from "./bucket-create";
import { listBuckets } from "./bucket-listing";
import { copyObject } from "./copy";
import { deleteKeys } from "./delete";
import { listKeysPage, listPage } from "./listing";
import {
   abortMultipartUploads,
   listMultipartUploads,
} from "./multipart-uploads";
import { headReviewed } from "./object-metadata";
import { presignedUrl } from "./presign";
import { renameObject } from "./rename";
import { streamUpload } from "./upload";

const endpoint = process.env.S3_INTEGRATION_ENDPOINT;
const isB2 = !!backblazeRegion(endpoint ?? "");
const provider = detectProvider(endpoint ?? "");
const run = randomUUID();
const bucket = `s3-viewer-integration-${run}`;
const secondBucket = `s3-viewer-second-${run}`;

const CENTRAL_FILE = 0x02014b50;
const ZIP64_EOCD = Buffer.from([0x50, 0x4b, 0x06, 0x06]);
const EOCD = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
const NO_32_BIT_VALUE = 0xffffffff;

// zip64 extras restate, in order, whichever of size, compressed size and offset overflowed.
const wideFields = (extra: Buffer): number[] => {
   for (let at = 0; at + 4 <= extra.length; ) {
      const size = extra.readUInt16LE(at + 2);
      if (extra.readUInt16LE(at) !== 1) {
         at += 4 + size;
         continue;
      }
      const values: number[] = [];
      for (let field = 0; field + 8 <= size; field += 8)
         values.push(Number(extra.readBigUInt64LE(at + 4 + field)));
      return values;
   }
   return [];
};

const readZipEntries = (
   zip: Buffer
): { name: string; size: number; data: Buffer }[] => {
   const zip64 = zip.lastIndexOf(ZIP64_EOCD);
   let cursor =
      zip64 >= 0
         ? Number(zip.readBigUInt64LE(zip64 + 48))
         : zip.readUInt32LE(zip.lastIndexOf(EOCD) + 16);
   const entries: { name: string; size: number; data: Buffer }[] = [];
   while (
      cursor + 46 <= zip.length &&
      zip.readUInt32LE(cursor) === CENTRAL_FILE
   ) {
      const nameLength = zip.readUInt16LE(cursor + 28);
      const extraLength = zip.readUInt16LE(cursor + 30);
      const commentLength = zip.readUInt16LE(cursor + 32);
      const name = zip.toString("utf8", cursor + 46, cursor + 46 + nameLength);
      const wide = wideFields(
         zip.subarray(
            cursor + 46 + nameLength,
            cursor + 46 + nameLength + extraLength
         )
      );
      let taken = 0;
      const resolve = (value: number): number =>
         value === NO_32_BIT_VALUE ? (wide[taken++] ?? value) : value;
      const size = resolve(zip.readUInt32LE(cursor + 24));
      const compressed = resolve(zip.readUInt32LE(cursor + 20));
      const local = resolve(zip.readUInt32LE(cursor + 42));
      const start =
         local +
         30 +
         zip.readUInt16LE(local + 26) +
         zip.readUInt16LE(local + 28);
      entries.push({
         name,
         size,
         data: zip.subarray(start, start + compressed),
      });
      cursor += 46 + nameLength + extraLength + commentLength;
   }
   return entries;
};

describe.skipIf(!endpoint)(
   "S3 provider integration in a disposable bucket",
   () => {
      let client: S3Client;
      const created: string[] = [];
      const scope = () => ({
         client,
         bucket,
         signal: AbortSignal.timeout(30_000),
      });
      const put = (key: string, data: string) =>
         client.send(
            new PutObjectCommand({ Bucket: bucket, Key: key, Body: data })
         );
      const readFrom = async (from: string, key: string) => {
         const out = await client.send(
            new GetObjectCommand({ Bucket: from, Key: key })
         );
         return Buffer.from(await out.Body!.transformToByteArray());
      };
      const read = (key: string) => readFrom(bucket, key);
      const renameReviewed = async (key: string, destination: string) => {
         const reviewed = await client.send(
            new HeadObjectCommand({ Bucket: bucket, Key: key })
         );
         expect(reviewed.ETag).toBeTruthy();
         return renameObject(scope(), provider, {
            objectKey: key,
            newObjectKey: destination,
            source: await headReviewed(scope(), key, reviewed.ETag!),
            sourceETag: reviewed.ETag!,
         });
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
         for (const name of [bucket, secondBucket]) {
            await createNewBucket(
               client,
               detectProvider(endpoint),
               name,
               AbortSignal.timeout(30_000)
            );
            created.push(name);
         }
      }, 60_000);

      const discardBucket = async (name: string) => {
         const incomplete = await client.send(
            new ListMultipartUploadsCommand({ Bucket: name })
         );
         for (const entry of incomplete.Uploads ?? []) {
            await client.send(
               new AbortMultipartUploadCommand({
                  Bucket: name,
                  Key: entry.Key,
                  UploadId: entry.UploadId,
               })
            );
         }
         // B2 versions by default, so key-only deletes leave delete markers behind.
         if (isB2) {
            for (;;) {
               const versions = await client.send(
                  new ListObjectVersionsCommand({ Bucket: name })
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
                     Bucket: name,
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
               new ListObjectsV2Command({ Bucket: name })
            );
            const objects = (page.Contents ?? []).flatMap((entry) =>
               entry.Key ? [{ Key: entry.Key }] : []
            );
            if (!objects.length) break;
            const removed = await client.send(
               new DeleteObjectsCommand({
                  Bucket: name,
                  Delete: { Objects: objects },
               })
            );
            if (removed.Errors?.length)
               throw new Error("Disposable integration bucket cleanup failed");
         }
         await client.send(new DeleteBucketCommand({ Bucket: name }));
      };

      afterAll(async () => {
         if (!created.length) {
            client?.destroy();
            return;
         }
         try {
            for (const name of created) await discardBucket(name);
         } finally {
            client.destroy();
         }
      }, 60_000);

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
         const outcome = streamUpload({
            client: isolated,
            bucket,
            key,
            body: Readable.from([Buffer.alloc(6 * MIB)]),
            contentType: "application/octet-stream",
            contentLength: 6 * MIB,
            partSize: 5 * MIB,
            maxBytes: 10 * MIB,
            abortController: new AbortController(),
         });
         await expect(outcome).rejects.toMatchObject({ status: 409 });
         expect((await read(key)).toString()).toBe(
            "external-change-during-upload"
         );
         expect(changed).toBe(true);
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

      it("renames an object with its metadata and leaves an occupied destination alone", async () => {
         await client.send(
            new PutObjectCommand({
               Bucket: bucket,
               Key: "rename/source.txt",
               Body: "rename-body",
               ContentType: "text/plain",
               CacheControl: "max-age=3600",
               ContentDisposition: "attachment",
               Metadata: { purpose: "provider-integration" },
               ...(provider === Provider.R2 || isB2
                  ? {}
                  : { Tagging: "test=preserve" }),
            })
         );
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
         await renameReviewed("rename/source.txt", "rename/result.txt");
         expect((await read("rename/result.txt")).toString()).toBe(
            "rename-body"
         );
         await expect(read("rename/source.txt")).rejects.toMatchObject({
            name: "NoSuchKey",
         });
         expect(
            await client.send(
               new HeadObjectCommand({
                  Bucket: bucket,
                  Key: "rename/result.txt",
               })
            )
         ).toMatchObject({
            ContentType: "text/plain",
            CacheControl: "max-age=3600",
            ContentDisposition: "attachment",
            Metadata: { purpose: "provider-integration" },
         });
      }, 30_000);

      it("renames an empty object and keeps an occupied destination", async () => {
         await put("empty/source", "");
         await put("empty/occupied", "keep-destination");
         await expect(
            renameReviewed("empty/source", "empty/occupied")
         ).rejects.toMatchObject({ status: 409 });
         expect((await read("empty/occupied")).toString()).toBe(
            "keep-destination"
         );
         expect(await read("empty/source")).toHaveLength(0);
         await renameReviewed("empty/source", "empty/result");
         expect(await read("empty/result")).toHaveLength(0);
         await expect(read("empty/source")).rejects.toMatchObject({
            name: "NoSuchKey",
         });
      }, 30_000);

      it("deletes selected objects and the recursively listed contents of a folder", async () => {
         await put("deletion/one", "one");
         await put("deletion/deep/two", "two");
         const keys = await listKeysPage(scope(), "deletion/", undefined);
         const result = await deleteKeys(scope(), keys.objects);
         expect(result.failed).toEqual([]);
         expect(result.deleted.sort()).toEqual([
            "deletion/deep/two",
            "deletion/one",
         ]);
         expect(
            (await listKeysPage(scope(), "deletion/", undefined)).objects
         ).toEqual([]);
      });

      it("rewrites an object's settings in place without touching its bytes", async () => {
         const key = "settings/report.csv";
         const body = "a,b\n1,2\n";
         await client.send(
            new PutObjectCommand({
               Bucket: bucket,
               Key: key,
               Body: body,
               ContentType: "text/plain",
               Metadata: { owner: "ops" },
            })
         );
         const before = await client.send(
            new HeadObjectCommand({ Bucket: bucket, Key: key })
         );
         await copyObject(scope(), provider, {
            sourceKey: key,
            destinationKey: key,
            source: before,
            sourceETag: before.ETag!,
            settings: {
               ContentType: "text/csv",
               CacheControl: "max-age=120",
               ContentDisposition: 'attachment; filename="report.csv"',
               Metadata: { owner: "finance", purpose: "settings-edit" },
            },
         });
         const after = await client.send(
            new HeadObjectCommand({ Bucket: bucket, Key: key })
         );
         expect(after).toMatchObject({
            ContentType: "text/csv",
            CacheControl: "max-age=120",
            ContentDisposition: 'attachment; filename="report.csv"',
            Metadata: { owner: "finance", purpose: "settings-edit" },
            ContentLength: before.ContentLength,
         });
         expect(after.StorageClass ?? null).toEqual(
            before.StorageClass ?? null
         );
         expect((await read(key)).toString()).toBe(body);
      }, 30_000);

      it("copies into another bucket on the same server and guards the destination", async () => {
         const key = "cross/source.txt";
         const body = "cross-bucket-body";
         await put(key, body);
         await client.send(
            new PutObjectCommand({
               Bucket: secondBucket,
               Key: "cross/occupied.txt",
               Body: "keep-destination",
            })
         );
         const head = await client.send(
            new HeadObjectCommand({ Bucket: bucket, Key: key })
         );
         const copyInto = (destinationKey: string, overwrite: boolean) =>
            copyObject(
               {
                  client,
                  bucket: secondBucket,
                  signal: AbortSignal.timeout(30_000),
               },
               provider,
               {
                  sourceBucket: bucket,
                  sourceKey: key,
                  destinationKey,
                  source: head,
                  sourceETag: head.ETag!,
                  overwrite,
               }
            );

         expect(await copyInto("cross/fresh.txt", false)).toMatchObject({
            size: body.length,
         });
         expect(
            (await readFrom(secondBucket, "cross/fresh.txt")).toString()
         ).toBe(body);

         await expect(
            copyInto("cross/occupied.txt", false)
         ).rejects.toMatchObject({ status: 409 });
         expect(
            (await readFrom(secondBucket, "cross/occupied.txt")).toString()
         ).toBe("keep-destination");

         expect(await copyInto("cross/occupied.txt", true)).toMatchObject({
            size: body.length,
         });
         expect(
            (await readFrom(secondBucket, "cross/occupied.txt")).toString()
         ).toBe(body);
         expect((await read(key)).toString()).toBe(body);
      }, 30_000);

      it("zips a folder and reads every entry back out of the archive", async () => {
         await put("zip/one.txt", "zip-one");
         await put("zip/deep/two.txt", "zip-two-body");
         const { entries, bytes } = await collectArchiveEntries(
            scope(),
            ["zip/"],
            { maxObjects: 100, maxBytes: 10 * MIB }
         );
         expect(entries.map((entry) => entry.name).sort()).toEqual([
            "zip/deep/two.txt",
            "zip/one.txt",
         ]);
         expect(bytes).toBe(19);
         const chunks: Buffer[] = [];
         await streamArchive({
            maxBytes: 10 * MIB,
            scope: scope(),
            entries,
            output: new Writable({
               write(chunk: Buffer, _encoding, done) {
                  chunks.push(chunk);
                  done();
               },
            }),
            abortController: new AbortController(),
         });
         const zipped = readZipEntries(Buffer.concat(chunks));
         expect(
            zipped.map(({ name, size, data }) => ({
               name,
               size,
               body: data.toString(),
            }))
         ).toEqual(
            expect.arrayContaining([
               { name: "zip/one.txt", size: 7, body: "zip-one" },
               { name: "zip/deep/two.txt", size: 12, body: "zip-two-body" },
            ])
         );
         expect(zipped).toHaveLength(2);
      }, 30_000);

      it("lists an incomplete multipart upload and aborts it", async () => {
         const key = "multipart/pending.bin";
         const started = await client.send(
            new CreateMultipartUploadCommand({ Bucket: bucket, Key: key })
         );
         const uploadId = started.UploadId!;
         expect(uploadId).toBeTruthy();
         // MinIO only honours a whole-key Prefix, so list the whole bucket.
         const listed = () =>
            listMultipartUploads(scope(), "provider-test", { prefix: "" }).then(
               ({ uploads }) => uploads
            );
         const [found] = await listed();
         expect(found).toMatchObject({ key });
         expect(found?.uploadId).not.toBe(uploadId);
         const ref = { key, uploadId: found!.uploadId };
         expect(
            await abortMultipartUploads(scope(), "provider-test", [ref])
         ).toEqual({ aborted: [ref], alreadyGone: [], failed: [] });
         expect(await listed()).toEqual([]);
      }, 30_000);

      it("deletes a key the caller could not review beforehand", async () => {
         await put("deletion/unreviewed", "gone");
         expect(
            await deleteKeys(scope(), [
               { key: "deletion/unreviewed", expectedETag: null },
               { key: "deletion/never-existed", expectedETag: null },
            ])
         ).toMatchObject({ failed: [] });
         await expect(read("deletion/unreviewed")).rejects.toMatchObject({
            name: "NoSuchKey",
         });
      });
   }
);
