import { Role } from "@s3-viewer/types";

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

const ROLE_RANK: Readonly<Record<Role, number>> = {
   [Role.VIEWER]: 0,
   [Role.EDITOR]: 1,
   [Role.ADMIN]: 2,
   [Role.OWNER]: 3,
};

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

const cumulative = (upTo: number): ReadonlySet<Permission> =>
   new Set(ROLES_ASCENDING.slice(0, upTo + 1).flatMap((r) => ROLE_GRANTS[r]));

const ROLE_PERMISSIONS: Readonly<Record<Role, ReadonlySet<Permission>>> = {
   [Role.VIEWER]: cumulative(0),
   [Role.EDITOR]: cumulative(1),
   [Role.ADMIN]: cumulative(2),
   [Role.OWNER]: cumulative(3),
};

const ROLE_LABELS: Readonly<Record<Role, string>> = {
   [Role.OWNER]: "Owner",
   [Role.ADMIN]: "Admin",
   [Role.EDITOR]: "Editor",
   [Role.VIEWER]: "Viewer",
};

const ROLE_DESCRIPTIONS: Readonly<Record<Role, string>> = {
   [Role.OWNER]: "Full control, including credentials and deleting the server.",
   [Role.ADMIN]:
      "Manage members, rename the server, remove buckets. Can only grant bucket access they hold themselves.",
   [Role.EDITOR]: "Upload and delete objects, and create new buckets.",
   [Role.VIEWER]: "Browse and download only.",
};

const rankOf = (role: Role | null | undefined): number =>
   role ? ROLE_RANK[role] : -1;

const isAtLeast = (role: Role | null | undefined, minimum: Role): boolean =>
   rankOf(role) >= ROLE_RANK[minimum];

const rolesAbove = (role: Role): Role[] =>
   ROLES_ASCENDING.filter((r) => rankOf(r) > rankOf(role));

const highestRole = (...roles: (Role | null | undefined)[]): Role | null =>
   roles.reduce<Role | null>(
      (best, r) => (r && rankOf(r) > rankOf(best) ? r : best),
      null
   );

const hasPermission = (
   role: Role | null | undefined,
   permission: Permission
): boolean => (role ? ROLE_PERMISSIONS[role].has(permission) : false);

const canManageRole = (actor: Role | null | undefined, target: Role): boolean =>
   target !== Role.OWNER &&
   hasPermission(actor, Permission.MANAGE_MEMBERS) &&
   rankOf(actor) > rankOf(target);

const assignableRoles = (actor: Role | null | undefined): Role[] =>
   ROLES_ASCENDING.filter((r) => canManageRole(actor, r));

const effectiveBucketRole = (
   serverRole: Role | null | undefined,
   bucketRole: Role | null | undefined
): Role | null =>
   serverRole === Role.OWNER ? Role.OWNER : (bucketRole ?? null);

export {
   Permission,
   ROLES_ASCENDING,
   ROLE_DESCRIPTIONS,
   ROLE_LABELS,
   assignableRoles,
   canManageRole,
   effectiveBucketRole,
   hasPermission,
   highestRole,
   isAtLeast,
   rankOf,
   rolesAbove,
};
