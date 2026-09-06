import { describe, expect, it } from "vitest";
import { putObjectQuerySchema } from "./s3";

const input = {
   serverId: "server123",
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
