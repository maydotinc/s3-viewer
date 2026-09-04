import { Role } from "@s3-viewer/types";
import { describe, expect, it } from "vitest";
import {
   Permission,
   ROLES_ASCENDING,
   ROLE_DESCRIPTIONS,
   assignableRoles,
   canManageRole,
   effectiveBucketRole,
   hasPermission,
   highestRole,
   isAtLeast,
   rolesAbove,
} from "./index";

const grantedTo = (role: Role) =>
   Object.values(Permission).filter((p) => hasPermission(role, p));

describe("role hierarchy", () => {
   it("is cumulative", () => {
      for (let i = 1; i < ROLES_ASCENDING.length; i++) {
         const lower = grantedTo(ROLES_ASCENDING[i - 1]!);
         const higher = grantedTo(ROLES_ASCENDING[i]!);
         for (const p of lower) expect(higher).toContain(p);
         expect(higher.length).toBeGreaterThan(lower.length);
      }
   });

   it("grants the expected permissions", () => {
      expect(hasPermission(Role.VIEWER, Permission.DOWNLOAD_OBJECT)).toBe(true);
      expect(hasPermission(Role.VIEWER, Permission.UPLOAD_OBJECT)).toBe(false);
      expect(hasPermission(Role.EDITOR, Permission.UPLOAD_OBJECT)).toBe(true);
      expect(hasPermission(Role.EDITOR, Permission.MANAGE_MEMBERS)).toBe(false);
      expect(hasPermission(Role.ADMIN, Permission.MANAGE_MEMBERS)).toBe(true);
      expect(hasPermission(Role.ADMIN, Permission.DELETE_SERVER)).toBe(false);
      expect(hasPermission(Role.OWNER, Permission.DELETE_SERVER)).toBe(true);
      expect(hasPermission(Role.ADMIN, Permission.UPDATE_CREDENTIALS)).toBe(
         false
      );
      expect(hasPermission(Role.OWNER, Permission.UPDATE_CREDENTIALS)).toBe(
         true
      );
      expect(hasPermission(null, Permission.LIST_BUCKETS)).toBe(false);
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

describe("clamping", () => {
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

describe("role descriptions", () => {
   it("describes what an editor may do to objects and to buckets", () => {
      expect(ROLE_DESCRIPTIONS[Role.EDITOR]).toBe(
         "Upload and delete objects, and create new buckets."
      );
   });

   it("says an admin can only pass on bucket access they hold", () => {
      expect(ROLE_DESCRIPTIONS[Role.ADMIN]).toMatch(/grant bucket access they/);
   });
});

describe("bucket scope", () => {
   it("owners bypass bucket grants, others need one", () => {
      expect(effectiveBucketRole(Role.OWNER, null)).toBe(Role.OWNER);
      expect(effectiveBucketRole(Role.ADMIN, null)).toBeNull();
      expect(effectiveBucketRole(Role.ADMIN, Role.VIEWER)).toBe(Role.VIEWER);
      expect(effectiveBucketRole(null, Role.EDITOR)).toBe(Role.EDITOR);
   });
});
