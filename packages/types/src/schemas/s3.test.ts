import { describe, expect, it } from "vitest";
import { putObjectQuerySchema } from "./s3";

const input = {
   serverId: "server123",
   expectedUserId: "user12345",
   bucketName: "backups",
   objectKey: "db.sql",
   contentType: "text/plain",
};

describe("upload preconditions", () => {
   it("allows create-only requests without an ETag", () => {
      expect(putObjectQuerySchema.parse(input).expectedETag).toBeUndefined();
   });

   it("accepts a strong observed ETag including a multipart suffix", () => {
      expect(
         putObjectQuerySchema.parse({ ...input, expectedETag: '"abc123-4"' })
            .expectedETag
      ).toBe('"abc123-4"');
   });

   it.each([
      "*",
      '"*"',
      "",
      'W/"abc"',
      '"abc", "other"',
      '"abc"\r\nX-Header: value',
      '"' + "x".repeat(256) + '"',
   ])(
      "rejects a precondition that is not one bounded strong ETag: %s",
      (expectedETag) => {
         expect(
            putObjectQuerySchema.safeParse({ ...input, expectedETag }).success
         ).toBe(false);
      }
   );
});

describe("destructive object request validation", () => {
   it.each([undefined, "*", '"*"', 'W/"abc"', '"abc", "other"', ""])(
      "rejects deletion with a missing or unsafe ETag field: %s",
      async (expectedETag) => {
         const { deleteObjectsBodySchema } = await import("./s3");
         expect(
            deleteObjectsBodySchema.safeParse({
               ...input,
               objects: [{ key: "db.sql", expectedETag }],
            }).success
         ).toBe(false);
      }
   );
   it("permits a null ETag for compatible one-shot deletion", async () => {
      const { deleteObjectsBodySchema } = await import("./s3");
      expect(
         deleteObjectsBodySchema.safeParse({
            ...input,
            objects: [{ key: "db.sql", expectedETag: null }],
         }).success
      ).toBe(true);
   });
   it("rejects duplicate keys with conflicting snapshots", async () => {
      const { deleteObjectsBodySchema } = await import("./s3");
      expect(
         deleteObjectsBodySchema.safeParse({
            ...input,
            objects: [
               { key: "db.sql", expectedETag: '"first"' },
               { key: "db.sql", expectedETag: '"second"' },
            ],
         }).success
      ).toBe(false);
   });
   it("requires the originating account on every destructive operation", async () => {
      const { deleteObjectsBodySchema, renameObjectBodySchema } = await import(
         "./s3"
      );
      const { expectedUserId, ...legacy } = input;
      void expectedUserId;
      expect(putObjectQuerySchema.safeParse(legacy).success).toBe(false);
      expect(
         deleteObjectsBodySchema.safeParse({
            ...legacy,
            objects: [{ key: "db.sql", expectedETag: '"original"' }],
         }).success
      ).toBe(false);
      expect(
         renameObjectBodySchema.safeParse({
            ...legacy,
            newObjectKey: "renamed.sql",
         }).success
      ).toBe(false);
   });
});
