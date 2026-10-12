import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import useCurrentServer from "@/lib/hooks/queries/server/useCurrentServer";
import {
   Permission,
   effectiveBucketRole,
   hasPermission,
} from "@s3-viewer/permissions";
import type { Role, ServerInfo } from "@s3-viewer/types";

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

const canCreateBucketOn = (server: ServerInfo | null | undefined): boolean =>
   server
      ? (server.canCreateBucket ??
        hasPermission(server.userRole, Permission.CREATE_BUCKET))
      : false;

const useCanCreateBucket = (): boolean =>
   canCreateBucketOn(useCurrentServer().currentServer);

export {
   canCreateBucketOn,
   useCanCreateBucket,
   useEffectiveRoleState,
   usePermission,
};
