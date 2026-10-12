import { describe, expect, it, vi } from "vitest";
import { Provider, Role } from "@s3-viewer/types";
import { storageCapabilities } from "./storage-capabilities";
import { toServerInfo } from "./servers";

vi.mock("@s3-viewer/db", () => ({ prisma: {} }));

const audit = {
   auditEnabled: false,
   auditViewRole: "OWNER",
   auditManageRole: "OWNER",
   auditRetentionDays: 0,
   auditLevel: "ALL",
} as const;
vi.mock("@/lib/utils/encryption", () => ({
   decryptCredentials: () => {
      throw new Error("server info must not open credentials");
   },
}));

describe("provider capabilities returned to clients", () => {
   it.each([
      [Provider.S3, "https://s3.amazonaws.com", null],
      [Provider.R2, "https://account.r2.cloudflarestorage.com", null],
      [
         Provider.Other,
         "https://s3.us-west-004.backblazeb2.com",
         "Conditional writes are not enforced by Backblaze B2; S3 Viewer checks before each write instead.",
      ],
      [Provider.Other, "https://minio.example.com", null],
   ] as const)("reports %s at %s", (provider, endpoint, notice) => {
      expect(storageCapabilities(provider, endpoint)).toEqual({
         upload: true,
         replace: true,
         rename: true,
         delete: true,
         deleteProtection: provider === Provider.S3 ? "conditional" : "checked",
         notice,
      });
   });

   it("keeps every feature on an existing B2 connection without exposing the endpoint", () => {
      const result = toServerInfo(
         {
            id: "server1234",
            name: "B2",
            provider: "Other",
            capabilities: storageCapabilities(
               Provider.Other,
               "https://s3.us-west-004.backblazeb2.com"
            ),
            ...audit,
         },
         Role.EDITOR
      );
      expect(result.capabilities).toMatchObject({
         upload: true,
         replace: true,
         rename: true,
         delete: true,
         notice: expect.stringContaining("Backblaze B2"),
      });
      expect(Object.keys(result).sort()).toEqual([
         "audit",
         "canCreateBucket",
         "capabilities",
         "id",
         "name",
         "provider",
         "userRole",
      ]);
      expect(JSON.stringify(result)).not.toContain("backblazeb2.com");
   });

   it("keeps a custom endpoint without stored capabilities visible with mutations disabled", () => {
      expect(
         toServerInfo(
            {
               id: "server1234",
               name: "Broken",
               provider: "Other",
               ...audit,
            },
            Role.OWNER
         ).capabilities
      ).toMatchObject({
         upload: false,
         replace: false,
         rename: false,
         delete: false,
      });
   });
});
