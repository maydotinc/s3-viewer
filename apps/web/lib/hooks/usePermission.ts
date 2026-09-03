import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import useServers from "@/lib/hooks/queries/server/useServers";
import {
   Permission,
   effectiveBucketRole,
   hasPermission,
} from "@s3-viewer/permissions";

const usePermission = (
   permission: Permission,
   bucketName?: string
): boolean => {
   const { currentServer } = useServers();
   const { buckets } = useBuckets();
   const serverRole = currentServer?.userRole ?? null;
   if (!bucketName) return hasPermission(serverRole, permission);
   const bucketRole =
      buckets.find((b) => b.name === bucketName)?.userRole ?? null;
   return hasPermission(
      effectiveBucketRole(serverRole, bucketRole),
      permission
   );
};

export { usePermission };
