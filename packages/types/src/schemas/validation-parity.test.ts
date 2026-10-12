import { describe, expect, it } from "vitest";
import {
   archiveRequestBodySchema,
   createFolderBodySchema,
   createMultipartBodySchema,
   abortMultipartBodySchema,
   copyObjectBodySchema,
   deleteObjectsBodySchema,
   existingObjectKeySchema,
   existingPrefixSchema,
   listObjectsQuerySchema,
   objectContentQuerySchema,
   objectKeySchema,
   profileNameSchema,
   putObjectQuerySchema,
   transferObjectBodySchema,
   updateObjectSettingsBodySchema,
} from "./index";

const scope = {
   serverId: "server123",
   bucketName: "photos",
   expectedUserId: "user12345",
};

describe("exact existing object identities", () => {
   it.each([
      "a//b.txt",
      "/abs.txt",
      "./x",
      "a/../x",
      "a\tb",
      "a\0b",
      " e\u0301 ",
   ])("preserves %j across reads, deletes and sources", (key) => {
      expect(existingObjectKeySchema.parse(key)).toBe(key);
      expect(
         objectContentQuerySchema.parse({ ...scope, objectKey: key }).objectKey
      ).toBe(key);
      expect(
         deleteObjectsBodySchema.parse({
            ...scope,
            objects: [{ key, expectedETag: null }],
         }).objects[0]?.key
      ).toBe(key);
      expect(
         copyObjectBodySchema.parse({
            ...scope,
            objectKey: key,
            newObjectKey: "copy.txt",
            expectedETag: '"old"',
         }).objectKey
      ).toBe(key);
      expect(
         archiveRequestBodySchema.parse({ ...scope, objectKeys: [key] })
            .objectKeys
      ).toEqual([key]);
      expect(
         transferObjectBodySchema.parse({
            ...scope,
            source: {
               bucketName: "photos",
               objectKey: key,
               expectedETag: null,
            },
            destination: {
               serverId: "server456",
               bucketName: "photos",
               objectKey: "copy.txt",
            },
            overwrite: false,
         }).source.objectKey
      ).toBe(key);
      expect(
         listObjectsQuerySchema.parse({
            ...scope,
            prefix: `${key}/`,
            blockSize: 100,
         }).prefix
      ).toBe(`${key}/`);
   });

   it.each(["a//b.txt", "/abs.txt", "./x", "a\tb", "a\0b"])(
      "keeps stricter new-key policy for %j",
      (key) => {
         expect(objectKeySchema.safeParse(key).success).toBe(false);
         expect(
            copyObjectBodySchema.safeParse({
               ...scope,
               objectKey: "source",
               newObjectKey: key,
               expectedETag: '"old"',
            }).success
         ).toBe(false);
      }
   );

   it("rejects lone surrogates without normalizing legitimate Unicode", () => {
      expect(existingObjectKeySchema.safeParse("a\ud800").success).toBe(false);
      expect(existingObjectKeySchema.parse("e\u0301")).toBe("e\u0301");
   });
});

describe("complete UTF-8 key limits", () => {
   it.each([
      "a".repeat(1024),
      "é".repeat(512),
      "😀".repeat(256),
      "p/" + "é".repeat(511),
   ])("accepts exactly 1024 bytes and rejects one more byte", (key) => {
      for (const schema of [
         objectKeySchema,
         existingObjectKeySchema,
         existingPrefixSchema,
      ]) {
         expect(schema.safeParse(key).success).toBe(true);
         expect(schema.safeParse(`${key}a`).success).toBe(false);
      }
   });
});

describe("file keys and folder markers", () => {
   it("allows exact slash-ending objects through the transfer endpoint", () => {
      expect(
         transferObjectBodySchema.parse({
            ...scope,
            source: {
               bucketName: "photos",
               objectKey: "raw/data/",
               expectedETag: '"reviewed"',
            },
            destination: {
               serverId: "server456",
               bucketName: "photos",
               objectKey: "copied/data/",
            },
            overwrite: false,
         }).source.objectKey
      ).toBe("raw/data/");
   });

   it("rejects file uploads to markers while permitting folder creation and old upload cleanup", () => {
      const input = {
         ...scope,
         objectKey: "docs/",
         contentType: "text/plain",
         totalBytes: 100,
      };
      expect(putObjectQuerySchema.safeParse(input).success).toBe(false);
      expect(createMultipartBodySchema.safeParse(input).success).toBe(false);
      expect(
         createFolderBodySchema.parse({ ...scope, folderKey: "docs/" })
            .folderKey
      ).toBe("docs/");
      expect(
         abortMultipartBodySchema.parse({ ...input, uploadId: "legacy-upload" })
            .objectKey
      ).toBe("docs/");
   });
});

describe("metadata identity", () => {
   const parse = (metadata: Record<string, string>) =>
      updateObjectSettingsBodySchema.safeParse({
         ...scope,
         objectKey: "file.txt",
         expectedETag: '"old"',
         contentType: "text/plain",
         metadata,
      });
   it.each<Record<string, string>>([
      { Owner: "alice", owner: "mallory" },
      { " owner ": "alice", owner: "mallory" },
   ])("rejects normalized name collisions", (metadata) => {
      expect(parse(metadata).success).toBe(false);
   });
   it("normalizes distinct names and keeps count and byte limits", () => {
      expect(
         parse({ Owner: "alice", " project ": "viewer" }).data?.metadata
      ).toEqual({ owner: "alice", project: "viewer" });
      expect(
         parse(
            Object.fromEntries(
               Array.from({ length: 51 }, (_, i) => [`key-${i}`, "x"])
            )
         ).success
      ).toBe(false);
      expect(parse({ key: "x".repeat(1025) }).success).toBe(false);
      expect(parse({ a: "x".repeat(1024), b: "x".repeat(1024) }).success).toBe(
         false
      );
   });
});

describe("shared display names", () => {
   it.each(["", "   ", "a".repeat(81), "a\nb", "a\0b", "a\ud800"])(
      "rejects invalid names %j",
      (name) => {
         expect(profileNameSchema.safeParse(name).success).toBe(false);
      }
   );
   it("accepts the boundary and trims ordinary whitespace", () => {
      expect(profileNameSchema.parse("a".repeat(80))).toHaveLength(80);
      expect(profileNameSchema.parse("  User Name  ")).toBe("User Name");
   });
});
