import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import useServers from "@/lib/hooks/queries/server/useServers";
import {
   Permission,
   effectiveBucketRole,
   hasPermission,
} from "@s3-viewer/permissions";
import type { Role } from "@s3-viewer/types";

// one lookup per component, so a caller that needs several permissions on the
// same bucket doesn't open a second pair of query observers for each.
const useEffectiveRole = (bucketName?: string): Role | null => {
   const { currentServer } = useServers();
   const { buckets } = useBuckets();
   const serverRole = currentServer?.userRole ?? null;
   if (!bucketName) return serverRole;
   const bucketRole =
      buckets.find((b) => b.name === bucketName)?.userRole ?? null;
   return effectiveBucketRole(serverRole, bucketRole);
};

const usePermission = (
   permission: Permission,
   bucketName?: string
): boolean => {
   const role = useEffectiveRole(bucketName);
   return hasPermission(role, permission);
};

export { useEffectiveRole, usePermission };
