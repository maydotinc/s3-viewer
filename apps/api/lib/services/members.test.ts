import { Role } from "@s3-viewer/types";
import { describe, expect, it, vi } from "vitest";
import { assertBucketGrants, type GrantingActor } from "./members";

vi.mock("@s3-viewer/db", () => ({ prisma: {} }));
vi.mock("@/lib/utils/encryption", () => ({ decryptCredentials: () => ({}) }));

const scope = { restrictedBuckets: true, allowedBuckets: ["photos", "logs"] };
const openScope = { restrictedBuckets: false, allowedBuckets: [] };

const actor = (
   serverRole: Role,
   bucketRoles: Record<string, Role> = {}
): GrantingActor => ({
   serverRole,
   bucketRoles: new Map(Object.entries(bucketRoles)),
});

describe("assertBucketGrants", () => {
   it("lets an owner grant anything", () => {
      expect(() =>
         assertBucketGrants(actor(Role.OWNER), scope, [
            { bucketName: "photos", role: Role.EDITOR },
         ])
      ).not.toThrow();
   });

   it("refuses an admin granting a bucket they hold nothing on", () => {
      expect(() =>
         assertBucketGrants(actor(Role.ADMIN), scope, [
            { bucketName: "photos", role: Role.EDITOR },
         ])
      ).toThrow(/don't have Editor access to photos/);
   });

   it("refuses an admin granting above what they hold on that bucket", () => {
      expect(() =>
         assertBucketGrants(actor(Role.ADMIN, { photos: Role.VIEWER }), scope, [
            { bucketName: "photos", role: Role.EDITOR },
         ])
      ).toThrow(/don't have Editor access to photos/);
   });

   it("lets an admin pass on a bucket role they hold", () => {
      expect(() =>
         assertBucketGrants(actor(Role.ADMIN, { photos: Role.EDITOR }), scope, [
            { bucketName: "photos", role: Role.EDITOR },
            { bucketName: "photos", role: Role.VIEWER },
         ])
      ).toThrow(/Duplicate bucket/);
      expect(() =>
         assertBucketGrants(actor(Role.ADMIN, { photos: Role.EDITOR }), scope, [
            { bucketName: "photos", role: Role.VIEWER },
         ])
      ).not.toThrow();
   });

   it("still checks the grant is a role the actor may assign at all", () => {
      expect(() =>
         assertBucketGrants(actor(Role.ADMIN, { photos: Role.ADMIN }), scope, [
            { bucketName: "photos", role: Role.ADMIN },
         ])
      ).toThrow(/can't grant Admin/);
   });

   it("rejects buckets outside a restricted server's allowlist", () => {
      expect(() =>
         assertBucketGrants(actor(Role.OWNER), scope, [
            { bucketName: "company-payroll", role: Role.VIEWER },
         ])
      ).toThrow(/Unknown bucket/);
   });

   it("holds an admin to their own grants even on an unrestricted server", () => {
      expect(() =>
         assertBucketGrants(actor(Role.ADMIN), openScope, [
            { bucketName: "anything", role: Role.VIEWER },
         ])
      ).toThrow(/don't have Viewer access to anything/);
   });
});
