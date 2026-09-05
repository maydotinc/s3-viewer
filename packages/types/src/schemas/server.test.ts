import { describe, expect, it } from "vitest";
import { MAX_VALIDATE_BUCKETS } from "../constants";
import { updateCredentialsSchema, validateBucketsSchema } from "./server";

const serverId = "cm0000000000000000000000";
const encryptedCredentials = "eyJ2IjoxfQ==";

const bucketNames = (count: number) =>
   Array.from({ length: count }, (_, i) => `bucket-${i}`);

describe("validateBucketsSchema", () => {
   it("accepts up to the per-call cap and dedupes", () => {
      const parsed = validateBucketsSchema.parse({
         encryptedCredentials,
         bucketNames: [...bucketNames(MAX_VALIDATE_BUCKETS), "bucket-0"],
      });
      expect(parsed.bucketNames).toHaveLength(MAX_VALIDATE_BUCKETS);
   });

   it("rejects an empty list or more buckets than the cap", () => {
      for (const names of [[], bucketNames(MAX_VALIDATE_BUCKETS + 1)]) {
         expect(
            validateBucketsSchema.safeParse({
               encryptedCredentials,
               bucketNames: names,
            }).success
         ).toBe(false);
      }
   });
});

describe("updateCredentialsSchema", () => {
   it("accepts a server id with an encrypted blob", () => {
      expect(
         updateCredentialsSchema.parse({ serverId, encryptedCredentials })
      ).toEqual({ serverId, encryptedCredentials });
   });

   it("rejects missing, empty or oversized blobs and bad ids", () => {
      for (const body of [
         { serverId },
         { serverId, encryptedCredentials: "" },
         { serverId, encryptedCredentials: "a".repeat(8193) },
         { serverId: "not-an-id", encryptedCredentials },
      ]) {
         expect(updateCredentialsSchema.safeParse(body).success).toBe(false);
      }
   });
});
