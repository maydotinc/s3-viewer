import { describe, expect, it } from "vitest";
import {
   keysQuerySchema,
   listObjectsQuerySchema,
   putObjectQuerySchema,
   renameObjectBodySchema,
} from "./s3";

const scope = {
   serverId: "cm0000000000000000000000",
   bucketName: "my-bucket",
};
const objectScope = { ...scope, objectKey: "docs/report.pdf" };

describe("listObjectsQuerySchema", () => {
   it("coerces blockSize from a query string and defaults prefix", () => {
      const parsed = listObjectsQuerySchema.parse({
         ...scope,
         blockSize: "50",
      });
      expect(parsed.blockSize).toBe(50);
      expect(parsed.prefix).toBe("");
      expect(parsed.continuationToken).toBeUndefined();
   });

   it("rejects prefixes the SDK can't encode", () => {
      for (const prefix of [
         "/docs/",
         `docs/${String.fromCharCode(0xd800)}`,
         `docs/${String.fromCharCode(0x0a)}`,
      ]) {
         expect(
            listObjectsQuerySchema.safeParse({
               ...scope,
               blockSize: "50",
               prefix,
            }).success,
            prefix
         ).toBe(false);
      }
      for (const prefix of ["", "docs/", "docs/😀/"]) {
         expect(
            listObjectsQuerySchema.safeParse({
               ...scope,
               blockSize: "50",
               prefix,
            }).success,
            prefix
         ).toBe(true);
      }
   });

   it("rejects out-of-range or non-integer blockSize", () => {
      expect(
         listObjectsQuerySchema.safeParse({ ...scope, blockSize: "0" }).success
      ).toBe(false);
      expect(
         listObjectsQuerySchema.safeParse({ ...scope, blockSize: "1001" })
            .success
      ).toBe(false);
      expect(
         listObjectsQuerySchema.safeParse({ ...scope, blockSize: "1.5" })
            .success
      ).toBe(false);
      expect(listObjectsQuerySchema.safeParse({ ...scope }).success).toBe(
         false
      );
   });
});

describe("putObjectQuerySchema", () => {
   it("defaults a blank contentType", () => {
      const parsed = putObjectQuerySchema.parse({
         ...objectScope,
         contentType: "  ",
      });
      expect(parsed.contentType).toBe("application/octet-stream");
   });

   it("keeps a well-formed contentType and rejects a malformed one", () => {
      expect(
         putObjectQuerySchema.parse({
            ...objectScope,
            contentType: "text/plain; charset=utf-8",
         }).contentType
      ).toBe("text/plain; charset=utf-8");
      expect(
         putObjectQuerySchema.safeParse({ ...objectScope, contentType: "text" })
            .success
      ).toBe(false);
      expect(
         putObjectQuerySchema.safeParse({
            ...objectScope,
            contentType: "a b/c",
         }).success
      ).toBe(false);
   });

   it("requires the object scope", () => {
      expect(
         putObjectQuerySchema.safeParse({ ...scope, contentType: "image/png" })
            .success
      ).toBe(false);
   });
});

describe("keysQuerySchema", () => {
   const parse = (prefix: string) =>
      keysQuerySchema.safeParse({ ...scope, prefix }).success;

   it("requires a trailing slash", () => {
      expect(parse("docs")).toBe(false);
      expect(parse("docs/")).toBe(true);
      expect(parse("a/b c/")).toBe(true);
   });

   it("rejects the root, leading slashes and empty or dot segments", () => {
      for (const prefix of [
         "/",
         "",
         "/docs/",
         "docs//",
         "./",
         "../",
         "a/../",
      ]) {
         expect(parse(prefix), prefix).toBe(false);
      }
   });
});

describe("renameObjectBodySchema", () => {
   it("accepts a different object key", () => {
      expect(
         renameObjectBodySchema.safeParse({
            ...objectScope,
            newObjectKey: "docs/final.pdf",
         }).success
      ).toBe(true);
   });

   it("rejects the same key and folder keys", () => {
      expect(
         renameObjectBodySchema.safeParse({
            ...objectScope,
            newObjectKey: objectScope.objectKey,
         }).success
      ).toBe(false);
      expect(
         renameObjectBodySchema.safeParse({
            ...scope,
            objectKey: "docs/",
            newObjectKey: "old/",
         }).success
      ).toBe(false);
   });
});
