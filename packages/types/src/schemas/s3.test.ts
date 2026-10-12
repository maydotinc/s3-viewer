import { describe, expect, it } from "vitest";
import { MAX_BATCH_KEYS } from "../constants";
import {
   bucketScope,
   copyObjectBodySchema,
   createFolderBodySchema,
   moveObjectsBodySchema,
   newBucketScope,
   putObjectQuerySchema,
   renameObjectBodySchema,
} from "./s3";

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
   it.each([undefined, null, "*", '"*"', 'W/"old"', ""])(
      "rejects rename without a valid observed ETag: %s",
      (expectedETag) => {
         expect(
            renameObjectBodySchema.safeParse({
               ...input,
               newObjectKey: "renamed.sql",
               expectedETag,
            }).success
         ).toBe(false);
      }
   );
   it("keeps the original observed ETag on rename", () => {
      expect(
         renameObjectBodySchema.parse({
            ...input,
            newObjectKey: "renamed.sql",
            expectedETag: '"reviewed-2"',
         }).expectedETag
      ).toBe('"reviewed-2"');
   });
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
            expectedETag: '"original"',
         }).success
      ).toBe(false);
   });
});

describe("bucket scopes", () => {
   const scoped = (bucketName: string) => ({
      serverId: input.serverId,
      bucketName,
   });

   it("opens an existing bucket whose name predates the current naming rules", () => {
      expect(bucketScope.safeParse(scoped("Company_Backups")).success).toBe(
         true
      );
      expect(bucketScope.safeParse(scoped("..")).success).toBe(false);
      expect(bucketScope.safeParse(scoped("a/b")).success).toBe(false);
   });

   it("holds a new bucket to the current naming rules", () => {
      expect(newBucketScope.safeParse(scoped("backups")).success).toBe(true);
      expect(newBucketScope.safeParse(scoped("Company_Backups")).success).toBe(
         false
      );
   });
});

describe("move, copy and folder requests", () => {
   const base = {
      serverId: input.serverId,
      expectedUserId: input.expectedUserId,
      bucketName: input.bucketName,
   };
   const move = (objects: unknown) =>
      moveObjectsBodySchema.safeParse({ ...base, objects }).success;
   const pair = { key: "db.sql", newKey: "old/db.sql", expectedETag: null };

   it("accepts a batch whose keys came from a listing page without ETags", () => {
      expect(move([pair])).toBe(true);
   });

   it("accepts exact slash-ending object moves without expanding their prefix", () => {
      expect(move([{ ...pair, key: "old/", newKey: "new/" }])).toBe(true);
   });

   it.each([
      ["a file moved onto a slash-ending key", [{ ...pair, newKey: "old/" }]],
      [
         "a slash-ending key moved onto a file key",
         [{ ...pair, key: "old/", newKey: "new" }],
      ],
      ["an unchanged key", [{ ...pair, newKey: pair.key }]],
      ["duplicate sources", [pair, { ...pair, newKey: "other/db.sql" }]],
      ["duplicate destinations", [pair, { ...pair, key: "other.sql" }]],
      ["an empty batch", []],
      [
         "more than MAX_BATCH_KEYS",
         Array.from({ length: MAX_BATCH_KEYS + 1 }, (_, i) => ({
            key: `${i}.sql`,
            newKey: `old/${i}.sql`,
            expectedETag: null,
         })),
      ],
   ])("refuses %s", (_name, objects) => {
      expect(move(objects)).toBe(false);
   });

   it("copies with the same shape as rename", () => {
      const body = {
         ...input,
         newObjectKey: "copy.sql",
         expectedETag: '"original"',
      };
      expect(copyObjectBodySchema.safeParse(body).success).toBe(true);
      expect(
         copyObjectBodySchema.safeParse({ ...body, objectKey: "old/" }).success
      ).toBe(false);
   });

   it.each([
      ['"replacing-this"', true],
      ['"*"', false],
      ["unquoted", false],
      ["", false],
   ])(
      "takes the reviewed destination ETag on a copy: %s",
      (expectedDestinationETag, ok) => {
         const body = {
            ...input,
            newObjectKey: "copy.sql",
            expectedETag: '"original"',
            expectedDestinationETag,
         };
         expect(copyObjectBodySchema.safeParse(body).success).toBe(ok);
      }
   );

   it.each([
      ["reports/", true],
      ["a/b/", true],
      ["reports", false],
      ["", false],
   ])("only accepts a folder key ending in a slash: %s", (folderKey, ok) => {
      expect(
         createFolderBodySchema.safeParse({ ...base, folderKey }).success
      ).toBe(ok);
   });
});
