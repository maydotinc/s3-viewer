import { ApiHttpError } from "@/lib/http";
import { toScopedGrant, type BucketRow } from "./bucket-grants";
import { isBucketAllowed, type BucketScopeSettings } from "./servers";
import {
   ErrorCode,
   MAX_BUCKET_NAMES,
   Role,
   sameFolderScope,
   type ScopedGrant,
   type UpdateRoleInput,
} from "@s3-viewer/shared";

type BucketGrant = NonNullable<UpdateRoleInput["bucketAccess"]>[number];

type GrantingActor = {
   serverRole: Role;
   bucketGrants: ReadonlyMap<string, ScopedGrant>;
};

type GrantRefusal = (message: string, bucket: string | null) => Error;

// only a bucket the actor holds is named in the audit row; any other name is whatever the caller typed.
const heldBucket = (
   bucketGrants: ReadonlyMap<string, ScopedGrant>,
   bucketName: string
): string | null => (bucketGrants.has(bucketName) ? bucketName : null);

const grantsByBucket = (
   rows: readonly BucketRow[]
): ReadonlyMap<string, ScopedGrant> =>
   new Map(rows.map((row) => [row.bucketName, toScopedGrant(row)]));

const holdsExactly = (
   held: ReadonlyMap<string, ScopedGrant>,
   { bucketName, role, folders }: BucketGrant
): boolean => {
   const grant = held.get(bucketName);
   return (
      grant !== undefined &&
      grant.role === role &&
      sameFolderScope(grant.folders, folders)
   );
};

const assertUniqueBuckets = (grants: readonly BucketGrant[]): void => {
   const seen = new Set<string>();
   for (const { bucketName } of grants) {
      if (seen.has(bucketName)) {
         throw new ApiHttpError(
            400,
            `Duplicate bucket: ${bucketName}`,
            ErrorCode.VALIDATION
         );
      }
      seen.add(bucketName);
   }
};

const assertBucketInScope = (
   actor: GrantingActor,
   scope: BucketScopeSettings,
   bucketName: string
): void => {
   // an admin with no grant on the bucket hits the same 403 in assertBucketGrants whether or not it is listed.
   if (actor.serverRole !== Role.OWNER && !actor.bucketGrants.has(bucketName)) {
      return;
   }
   if (!isBucketAllowed(scope, bucketName)) {
      throw new ApiHttpError(
         400,
         `Unknown bucket: ${bucketName}`,
         ErrorCode.VALIDATION
      );
   }
};

const sameGrants = (
   current: readonly BucketRow[],
   grants: readonly BucketGrant[]
): boolean => {
   const held = grantsByBucket(current);
   return (
      held.size === grants.length &&
      new Set(grants.map(({ bucketName }) => bucketName)).size === held.size &&
      grants.every((grant) => holdsExactly(held, grant))
   );
};

const assertAccessAsShown = (
   current: readonly BucketRow[],
   shown: readonly BucketGrant[],
   requested: readonly BucketGrant[]
): void => {
   if (!sameGrants(current, shown) && !sameGrants(current, requested)) {
      throw new ApiHttpError(
         409,
         "This member's access changed while you were editing it. Reopen it and try again."
      );
   }
};

// grants the editor never saw survive the save, so capping the submitted list alone would let the
// total outgrow what an owner's editor can send back as the access it was shown.
const assertBucketCount = (kept: number, adding: number): void => {
   if (kept + adding > MAX_BUCKET_NAMES) {
      throw new ApiHttpError(
         400,
         `A member can have access to at most ${MAX_BUCKET_NAMES} buckets`,
         ErrorCode.VALIDATION
      );
   }
};

export {
   assertAccessAsShown,
   assertBucketCount,
   assertBucketInScope,
   assertUniqueBuckets,
   grantsByBucket,
   heldBucket,
   holdsExactly,
};
export type { BucketGrant, GrantRefusal, GrantingActor };
