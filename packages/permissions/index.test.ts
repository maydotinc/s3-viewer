import { Role } from "@s3-viewer/types";
import { describe, expect, it } from "vitest";
import {
   Permission,
   assignableRoles,
   auditAccess,
   canGrantBucketRole,
   canManageRole,
   canRemoveAccess,
   effectiveBucketRole,
   hasPermission,
   highestRole,
   isAtLeast,
   rolesAbove,
} from "./index";

const ROLES_ASCENDING = [Role.VIEWER, Role.EDITOR, Role.ADMIN, Role.OWNER];

const grantedTo = (role: Role | null) =>
   Object.values(Permission).filter((p) => hasPermission(role, p));

describe("role hierarchy", () => {
   it("grants exactly this matrix", () => {
      expect(
         Object.fromEntries(
            ROLES_ASCENDING.map((role) => [role, grantedTo(role).sort()])
         )
      ).toEqual({
         [Role.VIEWER]: ["DOWNLOAD_OBJECT", "LIST_BUCKETS", "LIST_OBJECTS"],
         [Role.EDITOR]: [
            "CREATE_BUCKET",
            "DELETE_OBJECT",
            "DOWNLOAD_OBJECT",
            "LIST_BUCKETS",
            "LIST_OBJECTS",
            "UPLOAD_OBJECT",
         ],
         [Role.ADMIN]: [
            "CREATE_BUCKET",
            "DELETE_BUCKET",
            "DELETE_OBJECT",
            "DOWNLOAD_OBJECT",
            "LIST_BUCKETS",
            "LIST_OBJECTS",
            "MANAGE_MEMBERS",
            "RENAME_SERVER",
            "UPLOAD_OBJECT",
         ],
         [Role.OWNER]: [
            "CREATE_BUCKET",
            "DELETE_BUCKET",
            "DELETE_OBJECT",
            "DELETE_SERVER",
            "DOWNLOAD_OBJECT",
            "LIST_BUCKETS",
            "LIST_OBJECTS",
            "MANAGE_MEMBERS",
            "RENAME_SERVER",
            "UPDATE_CREDENTIALS",
            "UPLOAD_OBJECT",
         ],
      });
      expect(grantedTo(null)).toEqual([]);
   });

   it("compares ranks", () => {
      expect(isAtLeast(Role.ADMIN, Role.EDITOR)).toBe(true);
      expect(isAtLeast(Role.EDITOR, Role.ADMIN)).toBe(false);
      expect(isAtLeast(null, Role.VIEWER)).toBe(false);
      expect(highestRole(Role.VIEWER, Role.ADMIN, null)).toBe(Role.ADMIN);
      expect(highestRole(null, undefined)).toBeNull();
   });
});

describe("member management", () => {
   it("requires a strictly higher rank and never targets owners", () => {
      expect(canManageRole(Role.OWNER, Role.ADMIN)).toBe(true);
      expect(canManageRole(Role.OWNER, Role.OWNER)).toBe(false);
      expect(canManageRole(Role.ADMIN, Role.ADMIN)).toBe(false);
      expect(canManageRole(Role.ADMIN, Role.EDITOR)).toBe(true);
      expect(canManageRole(Role.ADMIN, Role.VIEWER)).toBe(true);
      expect(canManageRole(Role.EDITOR, Role.VIEWER)).toBe(false);
      expect(canManageRole(null, Role.VIEWER)).toBe(false);
   });

   it("lists assignable roles", () => {
      expect(assignableRoles(Role.OWNER)).toEqual([
         Role.VIEWER,
         Role.EDITOR,
         Role.ADMIN,
      ]);
      expect(assignableRoles(Role.ADMIN)).toEqual([Role.VIEWER, Role.EDITOR]);
      expect(assignableRoles(Role.EDITOR)).toEqual([]);
   });
});

describe("rolesAbove", () => {
   it("lists the roles that outrank a role", () => {
      expect(rolesAbove(Role.VIEWER)).toEqual([
         Role.EDITOR,
         Role.ADMIN,
         Role.OWNER,
      ]);
      expect(rolesAbove(Role.EDITOR)).toEqual([Role.ADMIN, Role.OWNER]);
      expect(rolesAbove(Role.OWNER)).toEqual([]);
   });
});

describe("bucket scope", () => {
   it("permits grants only below a managing actor's rank and within their held bucket role", () => {
      const expected: Record<Role, readonly Role[]> = {
         [Role.VIEWER]: [],
         [Role.EDITOR]: [],
         [Role.ADMIN]: [Role.VIEWER, Role.EDITOR],
         [Role.OWNER]: [Role.VIEWER, Role.EDITOR, Role.ADMIN],
      };
      for (const actor of [...ROLES_ASCENDING, null]) {
         for (const held of [...ROLES_ASCENDING, null]) {
            for (const target of ROLES_ASCENDING) {
               const canAssign =
                  actor !== null && expected[actor].includes(target);
               const withinBucket =
                  actor === Role.OWNER ||
                  (held !== null &&
                     ROLES_ASCENDING.indexOf(held) >=
                        ROLES_ASCENDING.indexOf(target));
               expect(canGrantBucketRole(actor, held, target)).toBe(
                  canAssign && withinBucket
               );
            }
         }
      }
   });

   it("protects every bucket grant when removing a member or invitation", () => {
      expect(canRemoveAccess(Role.ADMIN, Role.VIEWER, [Role.ADMIN])).toBe(
         false
      );
      expect(
         canRemoveAccess(Role.ADMIN, Role.EDITOR, [Role.VIEWER, Role.EDITOR])
      ).toBe(true);
      expect(canRemoveAccess(Role.OWNER, Role.VIEWER, [Role.ADMIN])).toBe(true);
      expect(canRemoveAccess(Role.ADMIN, Role.ADMIN, [])).toBe(false);
      expect(canRemoveAccess(Role.OWNER, Role.OWNER, [])).toBe(false);
      expect(canRemoveAccess(Role.EDITOR, Role.VIEWER, [])).toBe(false);
      expect(canRemoveAccess(null, Role.VIEWER, [])).toBe(false);
   });

   it("owners bypass bucket grants, others need one", () => {
      expect(effectiveBucketRole(Role.OWNER, null)).toBe(Role.OWNER);
      expect(effectiveBucketRole(Role.ADMIN, null)).toBeNull();
      expect(effectiveBucketRole(Role.ADMIN, Role.VIEWER)).toBe(Role.VIEWER);
      expect(effectiveBucketRole(null, Role.EDITOR)).toBe(Role.EDITOR);
   });
});

describe("audit access", () => {
   const settings = {
      enabled: true,
      viewRole: Role.EDITOR,
      manageRole: Role.ADMIN,
   } as const;

   it("gates viewing and managing on the server's minimum roles", () => {
      expect(auditAccess(Role.OWNER, settings)).toEqual({
         enabled: true,
         canView: true,
         canManage: true,
         canVerify: true,
      });
      expect(auditAccess(Role.ADMIN, settings)).toEqual({
         enabled: true,
         canView: true,
         canManage: true,
         canVerify: true,
      });
      expect(auditAccess(Role.EDITOR, settings)).toEqual({
         enabled: true,
         canView: true,
         canManage: false,
         canVerify: false,
      });
      expect(auditAccess(Role.VIEWER, settings)).toEqual({
         enabled: true,
         canView: false,
         canManage: false,
         canVerify: false,
      });
   });

   it("keeps the owner in charge of a disabled, owner-only log", () => {
      const ownerOnly = {
         enabled: false,
         viewRole: Role.OWNER,
         manageRole: Role.OWNER,
      } as const;
      expect(auditAccess(Role.OWNER, ownerOnly)).toEqual({
         enabled: false,
         canView: true,
         canManage: true,
         canVerify: true,
      });
      expect(auditAccess(Role.ADMIN, ownerOnly)).toEqual({
         enabled: false,
         canView: false,
         canManage: false,
         canVerify: false,
      });
   });
});
