import {
   assignableRoles,
   canGrantBucketRole,
   rankOf,
} from "@s3-viewer/permissions";
import { GrantableRole, Role, S3Bucket } from "@s3-viewer/shared";

const grantableBucketRoles = (
   myRole: Role,
   bucket: S3Bucket
): GrantableRole[] =>
   assignableRoles(myRole).filter((role) =>
      canGrantBucketRole(myRole, bucket.userRole, role)
   );

const lowestRole = <T extends Role>(roles: readonly T[]): T | null =>
   roles.reduce<T | null>(
      (low, r) => (low === null || rankOf(r) < rankOf(low) ? r : low),
      null
   );

export { grantableBucketRoles, lowestRole };
