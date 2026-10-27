import { objectPermissions } from "@/lib/hooks/usePermission";
import { Role, type StorageCapabilities } from "@s3-viewer/shared";
import { describe, expect, it } from "vitest";

const capabilities = (writable: unknown): StorageCapabilities =>
   ({ writable, deleteProtection: null, notice: null }) as StorageCapabilities;

describe("objectPermissions", () => {
   it("grants write actions to an owner on writable storage", () => {
      expect(objectPermissions(Role.OWNER, capabilities(true))).toEqual({
         download: true,
         rename: true,
         upload: true,
         delete: true,
      });
   });

   // a server response without the flag must read as read-only, never as undefined
   it("treats a missing writable flag as read-only", () => {
      expect(objectPermissions(Role.OWNER, capabilities(undefined))).toEqual({
         download: true,
         rename: false,
         upload: false,
         delete: false,
      });
   });
});
