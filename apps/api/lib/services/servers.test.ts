import { describe, expect, it, vi } from "vitest";
import { MAX_SERVERS_PER_USER } from "@s3-viewer/types";
import {
   assertBucketRemovable,
   exceedsServerCap,
   isBucketAllowed,
} from "./servers";

vi.mock("@s3-viewer/db", () => ({ prisma: {} }));
vi.mock("@/lib/utils/encryption", () => ({ decryptCredentials: () => ({}) }));

const unrestricted = { restrictedBuckets: false, allowedBuckets: [] };
const restricted = (...allowedBuckets: string[]) => ({
   restrictedBuckets: true,
   allowedBuckets,
});

describe("isBucketAllowed", () => {
   it("allows every bucket on an unrestricted server", () => {
      expect(isBucketAllowed(unrestricted, "anything")).toBe(true);
   });

   it("allows only listed buckets on a restricted server", () => {
      expect(
         isBucketAllowed(restricted("public-assets"), "public-assets")
      ).toBe(true);
      expect(
         isBucketAllowed(restricted("public-assets"), "company-payroll")
      ).toBe(false);
   });

   it("allows nothing on a restricted server with an empty allowlist", () => {
      expect(isBucketAllowed(restricted(), "company-payroll")).toBe(false);
   });
});

describe("assertBucketRemovable", () => {
   it("refuses to remove the last bucket of a restricted server", () => {
      expect(() => assertBucketRemovable(restricted("only"), "only")).toThrow(
         /only bucket/
      );
   });

   it("removes a bucket while others remain", () => {
      expect(() =>
         assertBucketRemovable(restricted("a", "b"), "a")
      ).not.toThrow();
   });

   it("refuses a bucket the server never listed", () => {
      expect(() => assertBucketRemovable(restricted("a", "b"), "c")).toThrow(
         /Bucket not found/
      );
   });

   it("refuses removal on an unrestricted server instead of no-opping", () => {
      expect(() => assertBucketRemovable(unrestricted, "a")).toThrow(
         /every bucket its credentials allow/
      );
   });
});

describe("exceedsServerCap", () => {
   it("allows filling exactly up to the cap", () => {
      expect(exceedsServerCap(0)).toBe(false);
      expect(exceedsServerCap(MAX_SERVERS_PER_USER - 1)).toBe(false);
   });

   it("blocks a create that would cross the cap", () => {
      expect(exceedsServerCap(MAX_SERVERS_PER_USER)).toBe(true);
      expect(exceedsServerCap(MAX_SERVERS_PER_USER + 1)).toBe(true);
   });
});
