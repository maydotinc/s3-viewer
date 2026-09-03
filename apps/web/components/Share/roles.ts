import {
   ROLES_ASCENDING,
   assignableRoles,
   effectiveBucketRole,
   rankOf,
} from "@s3-viewer/permissions";
import { Role, S3Bucket } from "@s3-viewer/types";

const grantableBucketRoles = (myRole: Role, bucket: S3Bucket): Role[] => {
   const cap = rankOf(effectiveBucketRole(myRole, bucket.userRole));
   return assignableRoles(myRole).filter((r) => rankOf(r) <= cap);
};

const lowestRole = (roles: readonly Role[]): Role | null =>
   ROLES_ASCENDING.find((r) => roles.includes(r)) ?? null;

export { grantableBucketRoles, lowestRole };
