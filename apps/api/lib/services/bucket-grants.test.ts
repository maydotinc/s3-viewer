import { Role } from "@s3-viewer/types";
import { describe, expect, it } from "vitest";
import { findUnremovableGrant, withVisibleGrants } from "./bucket-grants";

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

describe("withVisibleGrants", () => {
   const member = {
      id: "user123456",
      bucketAccess: [
         { bucketName: "logs", role: Role.VIEWER, folders: null },
         { bucketName: "photos", role: Role.EDITOR, folders: ["a/"] },
      ],
   };

   it("keeps every grant for an owner's view", () => {
      expect(withVisibleGrants(null, member)).toEqual(member);
   });

   it("drops grants on buckets outside the view without touching the rest", () => {
      expect(withVisibleGrants(new Set(["photos"]), member)).toEqual({
         id: "user123456",
         bucketAccess: [
            { bucketName: "photos", role: Role.EDITOR, folders: ["a/"] },
         ],
      });
      expect(member.bucketAccess).toHaveLength(2);
   });
});
