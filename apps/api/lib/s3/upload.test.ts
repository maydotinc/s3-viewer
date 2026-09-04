import type { S3Client } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
   declaredLength,
   exceedsLimit,
   exceedsMaxPartSize,
   exceedsObjectLimit,
   isUploadTooLargeError,
   MAX_DERIVED_PART_BYTES,
   MAX_OBJECT_BYTES,
   MAX_PARTS,
   maxPartBytesFor,
   partSizeFor,
   streamUpload,
} from "./upload";

describe("declaredLength", () => {
   it("parses a well-formed Content-Length", () => {
      expect(declaredLength("0")).toBe(0);
      expect(declaredLength("1048576")).toBe(1048576);
   });

   it("is undefined when the header is missing or malformed", () => {
      expect(declaredLength(undefined)).toBeUndefined();
      expect(declaredLength("")).toBeUndefined();
      expect(declaredLength("abc")).toBeUndefined();
      expect(declaredLength("-1")).toBeUndefined();
      expect(declaredLength("1.5")).toBeUndefined();
      expect(declaredLength("1e400")).toBeUndefined();
   });
});

describe("exceedsLimit", () => {
   it("trips only when both sides are known and the size is above the cap", () => {
      expect(exceedsLimit(101, 100)).toBe(true);
      expect(exceedsLimit(100, 100)).toBe(false);
      expect(exceedsLimit(0, 100)).toBe(false);
   });

   it("never trips without a cap or without a declared size", () => {
      expect(exceedsLimit(10 ** 12, undefined)).toBe(false);
      expect(exceedsLimit(undefined, 100)).toBe(false);
      expect(exceedsLimit(undefined, undefined)).toBe(false);
   });
});

describe("partSizeFor", () => {
   const basePartBytes = 25 * 1024 * 1024;

   it("uses the base part size when the length is unknown or small", () => {
      expect(partSizeFor(undefined, basePartBytes)).toBe(basePartBytes);
      expect(partSizeFor(1024, basePartBytes)).toBe(basePartBytes);
   });

   it("grows the part size so a large declared length stays under MAX_PARTS parts", () => {
      const contentLength = basePartBytes * MAX_PARTS + 1;
      const partSize = partSizeFor(contentLength, basePartBytes);
      expect(partSize).toBeGreaterThan(basePartBytes);
      expect(Math.ceil(contentLength / partSize)).toBeLessThanOrEqual(
         MAX_PARTS
      );
   });

   it("clamps the derived part size so a huge declared length can't eat the heap", () => {
      expect(partSizeFor(MAX_OBJECT_BYTES, basePartBytes)).toBe(
         MAX_DERIVED_PART_BYTES
      );
      expect(partSizeFor(5 * 1024 ** 4, basePartBytes)).toBeLessThanOrEqual(
         MAX_DERIVED_PART_BYTES
      );
   });

   it("never clamps below a part size the operator asked for", () => {
      const bigBase = 512 * 1024 * 1024;
      expect(partSizeFor(MAX_OBJECT_BYTES, bigBase)).toBe(bigBase);
      expect(partSizeFor(undefined, bigBase)).toBe(bigBase);
   });
});

describe("maxPartBytesFor", () => {
   it("is the derived ceiling unless the configured part size is larger", () => {
      expect(maxPartBytesFor(25 * 1024 * 1024)).toBe(MAX_DERIVED_PART_BYTES);
      expect(maxPartBytesFor(MAX_DERIVED_PART_BYTES * 2)).toBe(
         MAX_DERIVED_PART_BYTES * 2
      );
   });
});

describe("exceedsObjectLimit", () => {
   it("trips only past S3's per-object limit", () => {
      expect(exceedsObjectLimit(undefined)).toBe(false);
      expect(exceedsObjectLimit(MAX_OBJECT_BYTES)).toBe(false);
      expect(exceedsObjectLimit(MAX_OBJECT_BYTES + 1)).toBe(true);
   });
});

describe("exceedsMaxPartSize", () => {
   const maxPartBytes = 100 * 1024 * 1024;

   it("is false when the length is unknown or fits under MAX_PARTS at the max part size", () => {
      expect(exceedsMaxPartSize(undefined, maxPartBytes)).toBe(false);
      expect(exceedsMaxPartSize(maxPartBytes * MAX_PARTS, maxPartBytes)).toBe(
         false
      );
   });

   it("is true when even the max part size can't fit the length under MAX_PARTS parts", () => {
      expect(
         exceedsMaxPartSize(maxPartBytes * MAX_PARTS + 1, maxPartBytes)
      ).toBe(true);
   });

   it("is only about part size now, so a huge length passes with a huge part size", () => {
      const generousMaxPartBytes = 5 * 1024 * 1024 * 1024;
      expect(
         exceedsMaxPartSize(MAX_OBJECT_BYTES + 1, generousMaxPartBytes)
      ).toBe(false);
      expect(exceedsObjectLimit(MAX_OBJECT_BYTES + 1)).toBe(true);
   });
});

describe("streamUpload byte cap", () => {
   const collect = async (chunks: Buffer[], maxBytes: number) => {
      const body = Readable.from(chunks);
      const sent: Buffer[] = [];
      const client = {
         config: { requestHandler: {} },
         send: async (command: { input: { Body?: unknown } }) => {
            const part = command.input.Body;
            if (part !== undefined) sent.push(Buffer.from(part as Uint8Array));
            return { ETag: '"etag"' };
         },
      } as unknown as S3Client;

      await streamUpload({
         client,
         bucket: "b",
         key: "k",
         contentType: "application/octet-stream",
         body,
         contentLength: undefined,
         partSize: 5 * 1024 * 1024,
         maxBytes,
         abortController: new AbortController(),
      });
      return Buffer.concat(sent).length;
   };

   it("rejects a chunked body that streams past the cap", async () => {
      const chunk = Buffer.alloc(64 * 1024, 1);
      await expect(
         collect([chunk, chunk, chunk], 100 * 1024)
      ).rejects.toSatisfy(isUploadTooLargeError);
   });

   it("does not trip the cap for a body at exactly the limit", async () => {
      const chunk = Buffer.alloc(64 * 1024, 1);
      const err = await collect([chunk], 64 * 1024).catch((e: unknown) => e);
      expect(isUploadTooLargeError(err)).toBe(false);
   });

   it("trips the cap one byte over the limit", async () => {
      const chunk = Buffer.alloc(64 * 1024, 1);
      const err = await collect([chunk], 64 * 1024 - 1).catch(
         (e: unknown) => e
      );
      expect(isUploadTooLargeError(err)).toBe(true);
   });
});
