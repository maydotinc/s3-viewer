import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { reply, s3Fixture } from "@/lib/testing/s3-fixture";
import {
   bufferedBodyReservationBytes,
   bufferedBodyRetainedBytes,
} from "./buffered-body";
import { installReadBudget } from "./read-budget.fixture";
import {
   cappedStreamCollector,
   MAX_RESPONSE_BYTES,
   withBufferedResponses,
} from "./response-collector";
import { estimateXmlMemory, RESPONSE_TOO_LARGE } from "./xml-response-guard";

afterEach(() => vi.restoreAllMocks());

const chunked = (chunk: Buffer, count: number): Readable =>
   Readable.from(
      (function* () {
         for (let i = 0; i < count; i++) yield chunk;
      })()
   );

describe("cappedStreamCollector", () => {
   it("collects a body under the cap whole", async () => {
      const bytes = await cappedStreamCollector(
         chunked(Buffer.from("<xml/>"), 3)
      );
      expect(Buffer.from(bytes).toString()).toBe("<xml/><xml/><xml/>");
   });

   it("rejects and destroys a body past the cap without buffering it", async () => {
      const chunk = Buffer.alloc(1024 * 1024);
      let pulled = 0;
      const endless = new Readable({
         read() {
            pulled++;
            this.push(chunk);
         },
      });
      await expect(cappedStreamCollector(endless)).rejects.toMatchObject({
         name: RESPONSE_TOO_LARGE,
      });
      expect(endless.destroyed).toBe(true);
      expect(pulled).toBeLessThan(MAX_RESPONSE_BYTES / chunk.length + 32);
   });

   it("accepts a web stream", async () => {
      const bytes = await cappedStreamCollector(
         Readable.toWeb(chunked(Buffer.from("ok"), 2))
      );
      expect(Buffer.from(bytes).toString()).toBe("okok");
   });

   it("checks a Blob's size before allocating its array buffer", async () => {
      const arrayBuffer = vi.fn();
      await expect(
         cappedStreamCollector({
            size: MAX_RESPONSE_BYTES + 1,
            arrayBuffer,
         } as unknown as Blob)
      ).rejects.toMatchObject({ name: RESPONSE_TOO_LARGE });
      expect(arrayBuffer).not.toHaveBeenCalled();
   });

   it("reserves structural memory before handing XML to the SDK and releases refusals", async () => {
      const bytes = Buffer.from(`<r>${"<a/>".repeat(1_000)}</r>`);
      // admits the raw body but not the parser's structural memory on top of it.
      const maxBytes =
         bufferedBodyRetainedBytes(bytes.length) + estimateXmlMemory(bytes) - 1;
      expect(maxBytes).toBeGreaterThan(
         bufferedBodyReservationBytes(bytes.length)
      );
      const budget = installReadBudget(maxBytes, {
         total: 1,
         user: 1,
         server: 1,
      });
      const body = Readable.from([bytes]);
      await expect(cappedStreamCollector(body)).rejects.toMatchObject({
         status: 429,
      });
      expect(body.destroyed).toBe(true);
      const next = budget.acquire({ serverId: "unscoped" });
      next.retain(maxBytes);
      next.release();
   });

   it("also guards Blob XML before returning its bytes", async () => {
      const blob = new Blob(["<r>".repeat(40) + "</r>".repeat(40)]);
      await expect(cappedStreamCollector(blob)).rejects.toMatchObject({
         name: RESPONSE_TOO_LARGE,
      });
   });
});

const offlineClient = (body: Readable) =>
   withBufferedResponses(
      s3Fixture(async () => reply(200, body), {
         endpoint: "https://storage.example.com",
      }).client,
      "xml-guard-server"
   );

describe("XML admission with the real SDK", () => {
   it("rejects tiny ignored elements before their parser allocations", async () => {
      const xml = `<ListBucketResult>${"<a/>".repeat(250_000)}</ListBucketResult>`;
      expect(Buffer.byteLength(xml)).toBeLessThan(MAX_RESPONSE_BYTES);
      const body = Readable.from([xml]);
      const client = offlineClient(body);
      try {
         await expect(
            client.send(new ListObjectsV2Command({ Bucket: "bucket" }))
         ).rejects.toMatchObject({ name: RESPONSE_TOO_LARGE });
         expect(body.destroyed).toBe(true);
      } finally {
         client.destroy();
      }
   });

   it("accepts 1,000 maximum-size URL-encoded Unicode keys with owner metadata", async () => {
      const key = encodeURIComponent("😀".repeat(256));
      const contents = `<Contents><Key>${key}</Key><LastModified>2026-01-01T00:00:00Z</LastModified><ETag>&quot;etag&quot;</ETag><Size>1</Size><StorageClass>STANDARD</StorageClass><Owner><ID>${"a".repeat(64)}</ID><DisplayName>owner</DisplayName></Owner></Contents>`;
      const xml = `<ListBucketResult><EncodingType>url</EncodingType>${contents.repeat(1_000)}</ListBucketResult>`;
      const client = offlineClient(Readable.from([xml]));
      try {
         const result = await client.send(
            new ListObjectsV2Command({ Bucket: "bucket" })
         );
         expect(result.Contents).toHaveLength(1_000);
         expect(result.Contents?.[0]?.Key).toBe(key);
      } finally {
         client.destroy();
      }
   });

   it("leaves successful object bodies streaming outside XML admission", async () => {
      const body = Readable.from(["<r>".repeat(40) + "</r>".repeat(40)]);
      const client = offlineClient(body);
      try {
         const result = await client.send(
            new GetObjectCommand({ Bucket: "bucket", Key: "key" })
         );
         expect(result.Body).toBe(body);
         expect(body.readableEnded).toBe(false);
      } finally {
         body.destroy();
         client.destroy();
      }
   });
});
