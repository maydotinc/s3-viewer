import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT_TYPE } from "../constants";
import {
   bucketNameSchema,
   contentTypeSchema,
   emailSchema,
   idSchema,
   objectKeySchema,
} from "./primitives";

describe("idSchema", () => {
   it("accepts Prisma cuids and Better Auth ids", () => {
      expect(idSchema.safeParse("cm0000000000000000000000").success).toBe(true);
      expect(
         idSchema.safeParse("Ab3dEf6hIj9kLm2nOp5qRs8tUv1wXy4z").success
      ).toBe(true);
   });

   it("rejects anything that is not a plain alphanumeric id", () => {
      for (const id of [
         "",
         "short",
         "a b",
         "id-with-dash",
         "../x",
         "a".repeat(65),
      ]) {
         expect(idSchema.safeParse(id).success, id).toBe(false);
      }
   });
});

describe("bucketNameSchema", () => {
   it("accepts valid names", () => {
      for (const name of ["abc", "my-bucket", "my.bucket.2", "a".repeat(63)]) {
         expect(bucketNameSchema.safeParse(name).success).toBe(true);
      }
   });

   it("rejects invalid names", () => {
      for (const name of [
         "ab",
         "a".repeat(64),
         "MyBucket",
         "-bucket",
         "bucket-",
         "my..bucket",
         "my.-bucket",
         "my-.bucket",
         "192.168.0.1",
         "my_bucket",
         "my bucket",
      ]) {
         expect(bucketNameSchema.safeParse(name).success).toBe(false);
      }
   });
});

describe("objectKeySchema", () => {
   it("accepts files and folder keys", () => {
      for (const key of [
         "file.txt",
         "a/b/c.txt",
         "folder/",
         "a b/c d.txt",
         "ünï/cødé.txt",
      ]) {
         expect(objectKeySchema.safeParse(key).success).toBe(true);
      }
   });

   it("rejects leading slashes, empty and dot segments", () => {
      for (const key of [
         "",
         "/file",
         "a//b",
         "./a",
         "a/../b",
         "..",
         "a".repeat(1025),
      ]) {
         expect(objectKeySchema.safeParse(key).success).toBe(false);
      }
   });
});

describe("emailSchema", () => {
   it("trims and lowercases", () => {
      expect(emailSchema.parse("  Ada@Example.COM  ")).toBe("ada@example.com");
   });

   it("rejects invalid addresses", () => {
      for (const value of ["", "not-an-email", "a@b", "a".repeat(255)]) {
         expect(emailSchema.safeParse(value).success, value).toBe(false);
      }
   });
});

describe("contentTypeSchema", () => {
   it("trims and falls back to the default", () => {
      expect(contentTypeSchema.parse(" image/png ")).toBe("image/png");
      expect(contentTypeSchema.parse("")).toBe(DEFAULT_CONTENT_TYPE);
      expect(contentTypeSchema.parse("   ")).toBe(DEFAULT_CONTENT_TYPE);
   });

   it("accepts parameters", () => {
      expect(contentTypeSchema.parse("text/plain; charset=utf-8")).toBe(
         "text/plain; charset=utf-8"
      );
   });

   it("rejects overlong, malformed and non-ASCII values", () => {
      for (const value of [
         "a".repeat(256),
         "noslash",
         "text/plain\r\nX-Injected: 1",
         "text/plän",
         "text/",
         "/plain",
      ]) {
         expect(contentTypeSchema.safeParse(value).success, value).toBe(false);
      }
   });
});
