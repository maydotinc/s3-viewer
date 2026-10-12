import { Role } from "@s3-viewer/types";
import { describe, expect, it } from "vitest";
import { findUnremovableGrant } from "./bucket-grants";

const row = (
   bucketName: string,
   role: Role,
   allowedFolders: string[] | null = null
) => ({
   bucketName,
   role,
   restrictedFolders: allowedFolders !== null,
   allowedFolders: allowedFolders ?? [],
});

const held = (entries: Record<string, Role>) =>
   new Map(
      Object.entries(entries).map(([bucket, role]) => [
         bucket,
         { role, folders: null },
      ])
   );

describe("findUnremovableGrant", () => {
   it("lets an owner remove anything, held or not", () => {
      expect(
         findUnremovableGrant(Role.OWNER, new Map(), [
            row("photos", Role.ADMIN),
            row("logs", Role.VIEWER),
         ])
      ).toBeUndefined();
   });

   it("names the first grant on a bucket the admin holds nothing on", () => {
      expect(
         findUnremovableGrant(Role.ADMIN, held({ logs: Role.EDITOR }), [
            row("logs", Role.VIEWER),
            row("photos", Role.VIEWER),
         ])
      ).toMatchObject({ bucketName: "photos" });
   });

   it("refuses a grant above the role held and another admin's grant", () => {
      expect(
         findUnremovableGrant(Role.ADMIN, held({ photos: Role.VIEWER }), [
            row("photos", Role.EDITOR),
         ])
      ).toBeDefined();
      expect(
         findUnremovableGrant(Role.ADMIN, held({ photos: Role.ADMIN }), [
            row("photos", Role.ADMIN),
         ])
      ).toBeDefined();
   });

   it("requires the held folders to cover the removed grant's folders", () => {
      const limited = new Map([
         ["photos", { role: Role.EDITOR, folders: ["a/"] }],
      ]);
      expect(
         findUnremovableGrant(Role.ADMIN, limited, [
            row("photos", Role.VIEWER, ["a/x/"]),
         ])
      ).toBeUndefined();
      expect(
         findUnremovableGrant(Role.ADMIN, limited, [
            row("photos", Role.VIEWER, ["b/"]),
         ])
      ).toBeDefined();
      expect(
         findUnremovableGrant(Role.ADMIN, limited, [row("photos", Role.VIEWER)])
      ).toBeDefined();
   });

   it("refuses everything for a caller with no server role", () => {
      expect(
         findUnremovableGrant(null, held({ photos: Role.ADMIN }), [
            row("photos", Role.VIEWER),
         ])
      ).toBeDefined();
   });
});
