import { MAX_GRANT_FOLDERS, Role, type ScopedGrant } from "@s3-viewer/types";
import { describe, expect, it } from "vitest";
import { canGrantBucketAccess, mergeBucketGrants } from "./index";

const grant = (role: Role, folders: string[] | null = null): ScopedGrant => ({
   role,
   folders,
});

describe("canGrantBucketAccess", () => {
   it("lets an owner grant any folders without holding a grant", () => {
      expect(
         canGrantBucketAccess(Role.OWNER, null, grant(Role.EDITOR, ["a/"]))
      ).toBe(true);
      expect(canGrantBucketAccess(Role.OWNER, null, grant(Role.ADMIN))).toBe(
         true
      );
   });

   it("never lets anyone limit an admin grant to folders", () => {
      expect(
         canGrantBucketAccess(Role.OWNER, null, grant(Role.ADMIN, ["a/"]))
      ).toBe(false);
   });

   it("lets a whole-bucket admin grant folders or the whole bucket", () => {
      const held = grant(Role.EDITOR);
      expect(
         canGrantBucketAccess(Role.ADMIN, held, grant(Role.EDITOR, ["a/"]))
      ).toBe(true);
      expect(canGrantBucketAccess(Role.ADMIN, held, grant(Role.VIEWER))).toBe(
         true
      );
   });

   it("keeps a folder-limited granter inside their own folders", () => {
      const held = grant(Role.EDITOR, ["landing/"]);
      const can = (target: ScopedGrant) =>
         canGrantBucketAccess(Role.ADMIN, held, target);
      expect(can(grant(Role.EDITOR, ["landing/"]))).toBe(true);
      expect(can(grant(Role.VIEWER, ["landing/img/"]))).toBe(true);
      expect(can(grant(Role.VIEWER))).toBe(false);
      expect(can(grant(Role.VIEWER, ["uploads/"]))).toBe(false);
      expect(can(grant(Role.VIEWER, ["landing/", "uploads/"]))).toBe(false);
      expect(can(grant(Role.VIEWER, ["landing-internal/"]))).toBe(false);
      expect(can(grant(Role.VIEWER, ["landing/../uploads/"]))).toBe(false);
   });

   it("still requires the role itself to be grantable", () => {
      expect(
         canGrantBucketAccess(
            Role.ADMIN,
            grant(Role.VIEWER, ["a/"]),
            grant(Role.EDITOR, ["a/"])
         )
      ).toBe(false);
      expect(
         canGrantBucketAccess(Role.ADMIN, null, grant(Role.VIEWER, ["a/"]))
      ).toBe(false);
      expect(
         canGrantBucketAccess(
            Role.EDITOR,
            grant(Role.EDITOR),
            grant(Role.VIEWER, ["a/"])
         )
      ).toBe(false);
   });
});

describe("mergeBucketGrants", () => {
   it("takes the invite when nothing is held", () => {
      expect(mergeBucketGrants(undefined, grant(Role.EDITOR, ["a/"]))).toEqual(
         grant(Role.EDITOR, ["a/"])
      );
   });

   it("joins folders when the role is the same", () => {
      expect(
         mergeBucketGrants(
            grant(Role.EDITOR, ["b/"]),
            grant(Role.EDITOR, ["a/", "b/x/"])
         )
      ).toEqual(grant(Role.EDITOR, ["a/", "b/"]));
      expect(
         mergeBucketGrants(grant(Role.VIEWER, ["a/"]), grant(Role.VIEWER))
      ).toEqual(grant(Role.VIEWER));
   });

   it("replaces held access only with an invite that covers all of it", () => {
      expect(
         mergeBucketGrants(grant(Role.VIEWER, ["a/"]), grant(Role.EDITOR))
      ).toEqual(grant(Role.EDITOR));
      expect(
         mergeBucketGrants(
            grant(Role.VIEWER, ["a/b/"]),
            grant(Role.EDITOR, ["a/"])
         )
      ).toEqual(grant(Role.EDITOR, ["a/"]));
      expect(
         mergeBucketGrants(grant(Role.EDITOR, ["a/"]), grant(Role.ADMIN))
      ).toEqual(grant(Role.ADMIN));
   });

   it("never widens a higher role to folders it was not granted on", () => {
      expect(
         mergeBucketGrants(grant(Role.VIEWER), grant(Role.EDITOR, ["a/"]))
      ).toEqual(grant(Role.VIEWER));
      expect(
         mergeBucketGrants(
            grant(Role.EDITOR, ["a/"]),
            grant(Role.VIEWER, ["b/"])
         )
      ).toEqual(grant(Role.EDITOR, ["a/"]));
      expect(
         mergeBucketGrants(grant(Role.EDITOR, ["a/"]), grant(Role.VIEWER))
      ).toEqual(grant(Role.EDITOR, ["a/"]));
   });

   it("keeps the held folders when joining would pass the cap", () => {
      const many = (prefix: string, count: number) =>
         Array.from({ length: count }, (_, i) => `${prefix}${i}/`);
      const held = grant(Role.EDITOR, many("a", MAX_GRANT_FOLDERS));
      expect(mergeBucketGrants(held, grant(Role.EDITOR, ["b/"]))).toEqual(held);
      expect(
         mergeBucketGrants(
            grant(Role.EDITOR, many("a", MAX_GRANT_FOLDERS - 1)),
            grant(Role.EDITOR, ["b/"])
         ).folders
      ).toHaveLength(MAX_GRANT_FOLDERS);
   });

   it("never produces a folder-limited admin", () => {
      expect(
         mergeBucketGrants(grant(Role.ADMIN), grant(Role.EDITOR, ["a/"]))
      ).toEqual(grant(Role.ADMIN));
   });
});
