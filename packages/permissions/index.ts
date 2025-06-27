import { Role } from "@s3-viewer/types";

enum Permission {
   // Server management
   DELETE_SERVER = "DELETE_SERVER",
   RENAME_SERVER = "RENAME_SERVER",

   // User management permissions by role level
   MANAGE_VIEWER = "MANAGE_VIEWER",
   MANAGE_EDITOR = "MANAGE_EDITOR",
   MANAGE_ADMIN = "MANAGE_ADMIN",

   // Bucket operations
   CREATE_BUCKET = "CREATE_BUCKET",
   DELETE_BUCKET = "DELETE_BUCKET",
   LIST_BUCKETS = "LIST_BUCKETS",

   // Object operations
   UPLOAD_OBJECT = "UPLOAD_OBJECT",
   DELETE_OBJECT = "DELETE_OBJECT",
   DOWNLOAD_OBJECT = "DOWNLOAD_OBJECT",
   LIST_OBJECTS = "LIST_OBJECTS",
}

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
   [Role.OWNER]: [
      // Owners can do everything including manage any role except other owners
      Permission.DELETE_SERVER,
      Permission.RENAME_SERVER,
      Permission.MANAGE_VIEWER,
      Permission.MANAGE_EDITOR,
      Permission.MANAGE_ADMIN,
      Permission.CREATE_BUCKET,
      Permission.DELETE_BUCKET,
      Permission.LIST_BUCKETS,
      Permission.UPLOAD_OBJECT,
      Permission.DELETE_OBJECT,
      Permission.DOWNLOAD_OBJECT,
      Permission.LIST_OBJECTS,
   ],
   [Role.ADMIN]: [
      // Admins can manage viewers/editors but not other admins
      Permission.RENAME_SERVER,
      Permission.MANAGE_VIEWER,
      Permission.MANAGE_EDITOR,
      Permission.CREATE_BUCKET,
      Permission.DELETE_BUCKET,
      Permission.LIST_BUCKETS,
      Permission.UPLOAD_OBJECT,
      Permission.DELETE_OBJECT,
      Permission.DOWNLOAD_OBJECT,
      Permission.LIST_OBJECTS,
   ],
   [Role.EDITOR]: [
      // Editors can modify content but can't manage users
      Permission.CREATE_BUCKET,
      Permission.LIST_BUCKETS,
      Permission.UPLOAD_OBJECT,
      Permission.DELETE_OBJECT,
      Permission.DOWNLOAD_OBJECT,
      Permission.LIST_OBJECTS,
   ],
   [Role.VIEWER]: [
      // Viewers can only read
      Permission.LIST_BUCKETS,
      Permission.DOWNLOAD_OBJECT,
      Permission.LIST_OBJECTS,
   ],
};

const hasPermissions = (role: Role, permissions: Permission[]): boolean => {
   return permissions.every((permission) =>
      ROLE_PERMISSIONS[role].includes(permission)
   );
};

export { hasPermissions, Permission };
