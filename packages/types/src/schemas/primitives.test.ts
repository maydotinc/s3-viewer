import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT_TYPE } from "../constants";
import {
   bucketNameSchema,
   canonicalMailbox,
   existingBucketNameSchema,
   contentTypeSchema,
   emailSchema,
   idSchema,
   objectKeySchema,
   plainLabel,
   profileNameSchema,
   serverNameSchema,
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

describe("existingBucketNameSchema", () => {
   it("accepts every name a new bucket may have", () => {
      for (const name of ["abc", "my-bucket", "my.bucket.2", "a".repeat(63)]) {
         expect(existingBucketNameSchema.safeParse(name).success).toBe(true);
      }
   });

   it("accepts names only older or other providers' buckets have", () => {
      for (const name of [
         "Company_Backups",
         "MyBucket",
         "my_bucket",
         "a".repeat(64),
         "A".repeat(255),
      ]) {
         expect(existingBucketNameSchema.safeParse(name).success).toBe(true);
      }
   });

   it("rejects names that could change the request path", () => {
      for (const name of [
         "",
         ".",
         "..",
         "...",
         "a/b",
         "../other",
         "a\\b",
         "my bucket",
         "bucket\n",
         "bucket\u0000",
         "bucket?x",
         "bucket#x",
         "bucket%2f",
      ]) {
         expect(existingBucketNameSchema.safeParse(name).success, name).toBe(
            false
         );
      }
   });

   it("keeps every other naming rule", () => {
      for (const name of [
         "ab",
         "a".repeat(256),
         "-bucket",
         "bucket-",
         "_bucket",
         "my..bucket",
         "my.-bucket",
         "my-.bucket",
         "192.168.0.1",
      ]) {
         expect(existingBucketNameSchema.safeParse(name).success, name).toBe(
            false
         );
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

   it("rejects control characters anywhere in the key", () => {
      for (const key of [
         "a\u0000b.txt",
         "\u0001leading.txt",
         "line\nbreak.txt",
         "carriage\rreturn.txt",
         "tab\tseparated.txt",
         "escape\u001b[31m.txt",
         "unit\u001f.txt",
         "delete\u007f.txt",
         "folder/\u0007bell",
      ]) {
         expect(objectKeySchema.safeParse(key).success, key).toBe(false);
      }
   });

   it("rejects unpaired surrogates but keeps valid pairs", () => {
      const high = String.fromCharCode(0xd800);
      const low = String.fromCharCode(0xdc00);
      for (const key of [high, `a/${high}b.txt`, `${low}.txt`, `pair${high}`]) {
         expect(objectKeySchema.safeParse(key).success, key).toBe(false);
      }
      for (const key of ["emoji😀.txt", high + low]) {
         expect(objectKeySchema.safeParse(key).success, key).toBe(true);
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

describe("display names", () => {
   it.each([
      ["right-to-left override", "invoice\u202Efdp.exe"],
      ["isolate", "a\u2066b"],
      ["zero-width space", "bit\u200B.ly"],
      ["stray joiner", "a\u200Db"],
      ["soft hyphen", "a\u00ADb"],
      ["C1 control", "a\u0085b"],
      ["line separator", "a\u2028b"],
      ["paragraph separator", "a\u2029b"],
   ])("rejects a %s", (_label, name) => {
      expect(profileNameSchema.safeParse(name).success).toBe(false);
      expect(serverNameSchema.safeParse(name).success).toBe(false);
   });

   it.each(["José Ünal", "日本語のサーバー", "Ops 👨‍👩‍👧 team", "👨🏽‍💻 dev", "🏳️‍🌈"])(
      "accepts %s",
      (name) => {
         expect(profileNameSchema.parse(name)).toBe(name);
         expect(serverNameSchema.parse(name)).toBe(name);
      }
   );
});

describe("plainLabel", () => {
   it.each([
      ["Verify at bit.ly/xx now", "Verify at [link] now"],
      ["see https://evil.example/login", "see [link]"],
      ["https://evil.com", "[link]"],
      ["www.evil.example", "[link]"],
      ["www.evil.com", "[link]"],
      ["evil.com/login", "[link]"],
      ["evil.com:8443/login", "[link]"],
      ["evil.com?next=x", "[link]"],
      ["ｂｉｔ．ｌｙ／ｘｘ", "[link]"],
      ["ｗｗｗ．evil．com", "[link]"],
      ["evil\u3002com/login", "[link]"],
      ["www\u3002evil\u3002com", "[link]"],
      ["Node.js assets", "Node.js assets"],
      ["prod.example.com", "prod.example.com"],
      ["evil\u3002com", "evil\u3002com"],
      ["support@evil.example", "support[at]evil.example"],
      ["＠team", "[at]team"],
      ["a\u202Eb\u200Bc", "abc"],
      ["line\nbreak\u2028here", "line break here"],
      ["  lots   of\tspace ", "lots of space"],
      ["Payroll Archive", "Payroll Archive"],
      ["v1.2 release", "v1.2 release"],
   ])("renders %j as %j", (value, expected) => {
      expect(plainLabel(value, "fallback")).toBe(expected);
   });

   it("truncates to 40 characters without splitting a surrogate pair", () => {
      const label = plainLabel(`${"a".repeat(38)}😀😀😀`, "x");
      expect(Array.from(label)).toHaveLength(40);
      expect(label).toBe(`${"a".repeat(38)}😀…`);
   });

   it("falls back when nothing printable is left", () => {
      expect(plainLabel("\u200B\u202E ", "a server")).toBe("a server");
   });
});

describe("canonicalMailbox", () => {
   it.each([
      ["Victim+a@Gmail.com", "victim@gmail.com"],
      ["v.i.c.t.i.m+b@googlemail.com", "victim@gmail.com"],
      ["first.last+news@corp.example", "first.last@corp.example"],
      ["+only@corp.example", "+only@corp.example"],
      ["plain@corp.example", "plain@corp.example"],
   ])("maps %s to %s", (email, mailbox) => {
      expect(canonicalMailbox(email)).toBe(mailbox);
   });
});
