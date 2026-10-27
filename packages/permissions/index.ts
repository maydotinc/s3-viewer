import {
   MAX_GRANT_FOLDERS,
   Role,
   canLimitToFolders,
   folderScopeCovers,
   normalizeFolders,
   type AuditAccess,
   type AuditSettings,
   type GrantableRole,
   type ScopedGrant,
} from "@s3-viewer/shared";

enum Permission {
   DELETE_SERVER = "DELETE_SERVER",
   UPDATE_CREDENTIALS = "UPDATE_CREDENTIALS",
   RENAME_SERVER = "RENAME_SERVER",
   MANAGE_MEMBERS = "MANAGE_MEMBERS",
   LIST_BUCKETS = "LIST_BUCKETS",
   CREATE_BUCKET = "CREATE_BUCKET",
   DELETE_BUCKET = "DELETE_BUCKET",
   LIST_OBJECTS = "LIST_OBJECTS",
   DOWNLOAD_OBJECT = "DOWNLOAD_OBJECT",
   UPLOAD_OBJECT = "UPLOAD_OBJECT",
   DELETE_OBJECT = "DELETE_OBJECT",
}

type MaybeRole = Role | null | undefined;

const ROLE_GRANTS: Readonly<Record<Role, readonly Permission[]>> = {
   [Role.VIEWER]: [
      Permission.LIST_BUCKETS,
      Permission.LIST_OBJECTS,
      Permission.DOWNLOAD_OBJECT,
   ],
   [Role.EDITOR]: [
      Permission.UPLOAD_OBJECT,
      Permission.DELETE_OBJECT,
      Permission.CREATE_BUCKET,
   ],
   [Role.ADMIN]: [
      Permission.DELETE_BUCKET,
      Permission.RENAME_SERVER,
      Permission.MANAGE_MEMBERS,
   ],
   [Role.OWNER]: [Permission.DELETE_SERVER, Permission.UPDATE_CREDENTIALS],
};

const ROLES_ASCENDING: readonly Role[] = [
   Role.VIEWER,
   Role.EDITOR,
   Role.ADMIN,
   Role.OWNER,
];

const ROLE_PERMISSIONS: ReadonlyMap<Role, ReadonlySet<Permission>> = new Map(
   ROLES_ASCENDING.map((role, rank) => [
      role,
      new Set(
         ROLES_ASCENDING.slice(0, rank + 1).flatMap((r) => ROLE_GRANTS[r])
      ),
   ])
);

const ROLE_LABELS: Readonly<Record<Role, string>> = {
   [Role.OWNER]: "Owner",
   [Role.ADMIN]: "Admin",
   [Role.EDITOR]: "Editor",
   [Role.VIEWER]: "Viewer",
};

const ROLE_DESCRIPTIONS: Readonly<Record<Role, string>> = {
   [Role.OWNER]: "Full control, including credentials and deleting the server.",
   [Role.ADMIN]:
      "Manage members, rename the server, remove buckets they hold admin access on. Can only grant bucket access they hold themselves.",
   [Role.EDITOR]: "Upload and delete objects, and create new buckets.",
   [Role.VIEWER]: "Browse and download only.",
};

const rankOf = (role: MaybeRole): number =>
   role ? ROLES_ASCENDING.indexOf(role) : -1;

const isAtLeast = (role: MaybeRole, minimum: Role): boolean =>
   rankOf(role) >= rankOf(minimum);

const rolesAbove = (role: Role): Role[] =>
   ROLES_ASCENDING.filter((r) => rankOf(r) > rankOf(role));

const highestRole = (...roles: MaybeRole[]): Role | null =>
   roles.reduce<Role | null>(
      (best, r) => (r && rankOf(r) > rankOf(best) ? r : best),
      null
   );

const hasPermission = (role: MaybeRole, permission: Permission): boolean =>
   role ? !!ROLE_PERMISSIONS.get(role)?.has(permission) : false;

const canManageRole = (actor: MaybeRole, target: Role): boolean =>
   target !== Role.OWNER &&
   hasPermission(actor, Permission.MANAGE_MEMBERS) &&
   rankOf(actor) > rankOf(target);

const assignableRoles = (actor: MaybeRole): GrantableRole[] =>
   ROLES_ASCENDING.filter((r): r is GrantableRole => canManageRole(actor, r));

const effectiveBucketRole = (
   serverRole: MaybeRole,
   bucketRole: MaybeRole
): Role | null =>
   serverRole === Role.OWNER ? Role.OWNER : (bucketRole ?? null);

const canGrantBucketRole = (
   serverRole: MaybeRole,
   bucketRole: MaybeRole,
   targetRole: Role
): boolean =>
   canManageRole(serverRole, targetRole) &&
   isAtLeast(effectiveBucketRole(serverRole, bucketRole), targetRole);

const canGrantBucketAccess = (
   serverRole: MaybeRole,
   held: ScopedGrant | null | undefined,
   target: ScopedGrant
): boolean =>
   (target.folders === null || canLimitToFolders(target.role)) &&
   canGrantBucketRole(serverRole, held?.role, target.role) &&
   (serverRole === Role.OWNER ||
      (held != null && folderScopeCovers(held.folders, target.folders)));

const dominates = (a: ScopedGrant, b: ScopedGrant): boolean =>
   rankOf(a.role) >= rankOf(b.role) && folderScopeCovers(a.folders, b.folders);

const mergeBucketGrants = (
   held: ScopedGrant | null | undefined,
   invited: ScopedGrant
): ScopedGrant => {
   if (!held) return invited;
   if (held.role === invited.role) {
      if (held.folders === null || invited.folders === null)
         return { role: held.role, folders: null };
      const folders = normalizeFolders([...held.folders, ...invited.folders]);
      // a longer list could never be saved again from the access editor.
      return folders.length > MAX_GRANT_FOLDERS
         ? held
         : { role: held.role, folders };
   }
   return dominates(invited, held) ? invited : held;
};

const canRemoveAccess = (
   actorRole: MaybeRole,
   targetRole: Role,
   bucketRoles: readonly Role[]
): boolean =>
   canManageRole(actorRole, targetRole) &&
   bucketRoles.every((role) => canManageRole(actorRole, role));

const auditAccess = (
   role: Role,
   settings: Pick<AuditSettings, "enabled" | "viewRole" | "manageRole">
): AuditAccess => {
   const canView = isAtLeast(role, settings.viewRole);
   return {
      enabled: settings.enabled,
      canView,
      canManage: isAtLeast(role, settings.manageRole),
      canVerify: canView && isAtLeast(role, Role.ADMIN),
   };
};

export {
   Permission,
   ROLE_DESCRIPTIONS,
   ROLE_LABELS,
   assignableRoles,
   auditAccess,
   canGrantBucketAccess,
   canGrantBucketRole,
   canManageRole,
   canRemoveAccess,
   effectiveBucketRole,
   hasPermission,
   highestRole,
   mergeBucketGrants,
   rankOf,
   rolesAbove,
};
