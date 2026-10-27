import type {
   CopyObjectCommandInput,
   HeadObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { Provider } from "@s3-viewer/shared";
import { httpFailureOf } from "@/lib/http";
import { aclsDisabled, destinationAcceptsAcl } from "./bucket-ownership";
import { rethrowCopyFailure, type CopyRequest } from "./copy-request";
import { StorageError } from "./errors";
import type { S3Scope } from "./listing";
import { aclAttributes, readObjectAcl } from "./object-acl";
import { redirectAttributes } from "./object-metadata";
import { readObjectTagging, taggingOf } from "./object-tagging";
import {
   BUFFER_MEMORY_FACTOR,
   copyRetainedString,
   readBudget,
   type ReadReservation,
} from "./read-budget";
import { budgetServerOf } from "./request-budget";
import { withReleased } from "./response-collector";

const COPY_RECORD_MEMORY_BYTES = 128;

const reserveCopyString = (
   { client }: S3Scope,
   value: string
): ReadReservation => {
   const reservation = readBudget.acquire({
      serverId: budgetServerOf(client) ?? "unscoped",
   });
   try {
      reservation.retain(
         BUFFER_MEMORY_FACTOR * (value.length * 2 + COPY_RECORD_MEMORY_BYTES)
      );
   } catch (error) {
      reservation.release();
      throw error;
   }
   reservation.finishRead();
   return reservation;
};

const retainCopyString = (
   scope: S3Scope,
   retained: ReadReservation[],
   value: string
): string => {
   retained.push(reserveCopyString(scope, value));
   return copyRetainedString(value);
};

// storage refuses a retain-until date already past, and a lapsed retention protects nothing anyway.
const lockAttributes = ({
   ObjectLockMode,
   ObjectLockRetainUntilDate,
   ObjectLockLegalHoldStatus,
}: HeadObjectCommandOutput): Partial<CopyObjectCommandInput> => ({
   ...(ObjectLockMode &&
      ObjectLockRetainUntilDate &&
      ObjectLockRetainUntilDate.getTime() > Date.now() && {
         ObjectLockMode,
         ObjectLockRetainUntilDate,
      }),
   ...(ObjectLockLegalHoldStatus === "ON" && { ObjectLockLegalHoldStatus }),
});

// cross-bucket copies use destination encryption defaults because KMS keys are region and policy specific.
const copyAttributes = (
   head: HeadObjectCommandOutput,
   crossBucket: boolean
): Partial<CopyObjectCommandInput> => ({
   ...redirectAttributes(head),
   ...lockAttributes(head),
   ...(head.StorageClass && { StorageClass: head.StorageClass }),
   ...(crossBucket
      ? {}
      : {
           ...(head.ServerSideEncryption && {
              ServerSideEncryption: head.ServerSideEncryption,
           }),
           ...(head.SSEKMSKeyId && { SSEKMSKeyId: head.SSEKMSKeyId }),
           ...(head.BucketKeyEnabled !== undefined && {
              BucketKeyEnabled: head.BucketKeyEnabled,
           }),
        }),
});

// a same-bucket source already holds grants the bucket accepted, so only a bucket known to have ACLs
// disabled drops them; across buckets a hidden ownership setting falls back to destination defaults, and a failed read fails the copy.
const preservesGrants = async (
   scope: S3Scope,
   provider: Provider,
   cross: boolean
): Promise<boolean> => {
   if (provider !== Provider.S3) return false;
   return cross ? destinationAcceptsAcl(scope) : !(await aclsDisabled(scope));
};

const GRANTS_UNPRESERVABLE =
   "The object's access permissions could not be preserved. Refresh and try again.";

const grantAttributes = async (
   scope: S3Scope,
   { sourceClient = scope.client, sourceKey }: CopyRequest,
   bucket: string,
   strict: boolean,
   retained: ReadReservation[]
): Promise<Partial<CopyObjectCommandInput>> => {
   try {
      const output = await readObjectAcl(
         { ...scope, client: sourceClient, bucket },
         sourceKey
      );
      return withReleased(output, () =>
         Object.fromEntries(
            Object.entries(aclAttributes(output)).map(([field, value]) => [
               field,
               typeof value === "string"
                  ? retainCopyString(scope, retained, value)
                  : value,
            ])
         )
      );
   } catch (error) {
      if (!strict) return {};
      if (httpFailureOf(error)) throw error;
      throw new StorageError("conflict", GRANTS_UNPRESERVABLE);
   }
};

// multipart initiation (CreateMultipartUpload) has no TaggingDirective; restate tags, requiring them for in-place rewrites.
const sourceTagging = async (
   scope: S3Scope,
   { sourceClient = scope.client, sourceKey }: CopyRequest,
   bucket: string,
   strict: boolean,
   retained: ReadReservation[]
): Promise<string | undefined> => {
   try {
      const output = await readObjectTagging(
         { ...scope, client: sourceClient, bucket },
         sourceKey
      );
      return withReleased(output, () => {
         const tagging = taggingOf(output.TagSet);
         return tagging === undefined
            ? undefined
            : retainCopyString(scope, retained, tagging);
      });
   } catch (error) {
      if (!strict) return undefined;
      return rethrowCopyFailure(error);
   }
};

export {
   copyAttributes,
   grantAttributes,
   preservesGrants,
   retainCopyString,
   sourceTagging,
};
