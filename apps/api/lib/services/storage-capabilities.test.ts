import { describe, expect, it, vi } from "vitest";
import { Provider, Role } from "@s3-viewer/types";
import { storageCapabilities } from "./storage-capabilities";
import { toServerInfo } from "./servers";

vi.mock("@s3-viewer/db", () => ({ prisma: {} }));
vi.mock("@/lib/utils/encryption", () => ({
   decryptCredentials: (encrypted: string) => {
      if (encrypted === "unreadable") throw new Error("Bad credentials");
      return {
         endpoint: encrypted,
         accessKey: "never-return-this",
         secretKey: "secret",
      };
   },
}));

describe("provider capabilities returned to clients", () => {
   it.each([
      [Provider.S3, "https://s3.amazonaws.com", true, true],
      [Provider.R2, "https://account.r2.cloudflarestorage.com", true, true],
      [Provider.Other, "https://s3.us-west-004.backblazeb2.com", false, false],
      [Provider.Other, "https://minio.example.com", true, false],
   ] as const)(
      "reports %s at %s",
      (provider, endpoint, upload, destructive) => {
         expect(storageCapabilities(provider, endpoint)).toMatchObject({
            upload,
            replace: provider === Provider.R2,
            rename: false,
            delete: destructive,
         });
      }
   );

   it("distinguishes existing B2 connections without exposing credentials or endpoint", () => {
      const result = toServerInfo(
         {
            id: "server1234",
            name: "B2",
            provider: "Other",
            credentials: "https://s3.us-west-004.backblazeb2.com",
         },
         Role.EDITOR
      );
      expect(result.capabilities).toMatchObject({
         upload: false,
         rename: false,
         delete: false,
      });
      expect(Object.keys(result).sort()).toEqual([
         "capabilities",
         "id",
         "name",
         "provider",
         "userRole",
      ]);
      expect(JSON.stringify(result)).not.toContain("backblazeb2.com");
   });

   it("keeps unreadable connections visible with mutations disabled", () => {
      expect(
         toServerInfo(
            {
               id: "server1234",
               name: "Broken",
               provider: "Other",
               credentials: "unreadable",
            },
            Role.OWNER
         ).capabilities
      ).toMatchObject({
         upload: false,
         rename: false,
         delete: false,
      });
   });
});
