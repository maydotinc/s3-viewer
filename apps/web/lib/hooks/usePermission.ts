import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import useCurrentServer from "@/lib/hooks/queries/server/useCurrentServer";
import {
   Permission,
   effectiveBucketRole,
   hasPermission,
} from "@s3-viewer/permissions";
import type {
   Role,
   S3Bucket,
   ServerInfo,
   StorageCapabilities,
} from "@s3-viewer/types";

type RoleState = {
   role: Role | null;
   pending: boolean;
};

const useEffectiveRoleState = (bucketName?: string): RoleState => {
   const { currentServer, isLoading: isServerLoading } = useCurrentServer();
   const { buckets, isBucketsLoading } = useBuckets();
   const serverRole = currentServer?.userRole ?? null;
   if (!bucketName) return { role: serverRole, pending: isServerLoading };
   const bucketRole =
      buckets.find((b) => b.name === bucketName)?.userRole ?? null;
   return {
      role: effectiveBucketRole(serverRole, bucketRole),
      pending: isServerLoading || isBucketsLoading,
   };
};

const useEffectiveRole = (bucketName?: string): Role | null =>
   useEffectiveRoleState(bucketName).role;

const usePermission = (
   permission: Permission,
   bucketName?: string
): boolean => {
   const role = useEffectiveRole(bucketName);
   return hasPermission(role, permission);
};

type ObjectPermissions = {
   download: boolean;
   rename: boolean;
   upload: boolean;
   delete: boolean;
};

const objectPermissions = (
   role: Role | null,
   capabilities: StorageCapabilities
): ObjectPermissions => ({
   download: hasPermission(role, Permission.DOWNLOAD_OBJECT),
   rename:
      capabilities.writable && hasPermission(role, Permission.DELETE_OBJECT),
   upload:
      capabilities.writable && hasPermission(role, Permission.UPLOAD_OBJECT),
   delete:
      capabilities.writable && hasPermission(role, Permission.DELETE_OBJECT),
});

const canCreateBucketOn = (server: ServerInfo | null | undefined): boolean =>
   server?.canCreateBucket ?? false;

// only a listed bucket on a restricted server can come off the allow-list
const canRemoveBucket = (
   server: ServerInfo | null | undefined,
   bucket: S3Bucket | undefined
): boolean =>
   Boolean(server?.canRemoveBuckets) &&
   bucket !== undefined &&
   hasPermission(bucket.userRole, Permission.DELETE_BUCKET);

const useCanCreateBucket = (): boolean =>
   canCreateBucketOn(useCurrentServer().currentServer);

export {
   canCreateBucketOn,
   canRemoveBucket,
   objectPermissions,
   useCanCreateBucket,
   useEffectiveRoleState,
   usePermission,
};
export type { ObjectPermissions };
