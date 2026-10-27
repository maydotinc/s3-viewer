import { OBJECT_EXISTS } from "@/lib/constants";
import type {
   CopyObjectCommandInput,
   HeadObjectCommandOutput,
   S3Client,
} from "@aws-sdk/client-s3";
import { Provider } from "@s3-viewer/shared";
import {
   assertDestinationAbsent,
   conflictAs,
   enforcesConditions,
   isUploadConflict,
   writeCondition,
   type WriteCondition,
} from "./conditions";
import { StorageError } from "./errors";
import { describeFailure } from "./failure";
import { headIfExists } from "./head";
import { encodeCopySource } from "./keys";
import type { S3Scope } from "./listing";
import { copyRetainedString } from "./read-budget";

// the copy has landed by now, so its ETag is not reserved: a refusal would report a committed copy as failed.
const copyResult = (eTag: string | undefined, size: number): CopyResult => ({
   eTag: eTag === undefined ? null : copyRetainedString(eTag),
   size,
});

type CopySettings = Partial<
   Pick<
      CopyObjectCommandInput,
      | "ContentType"
      | "CacheControl"
      | "ContentDisposition"
      | "ContentEncoding"
      | "ContentLanguage"
      | "Expires"
      | "Metadata"
   >
>;

type CopyRequest = {
   sourceKey: string;
   destinationKey: string;
   source: HeadObjectCommandOutput;
   sourceETag: string;
   sourceBucket?: string;
   sourceClient?: S3Client;
   overwrite?: boolean;
   destinationETag?: string;
   settings?: CopySettings;
};

type CopyResult = { eTag: string | null; size: number };

type DestinationETag = string | null;

const copyConflict = () =>
   new StorageError(
      "conflict",
      "The original changed or the destination already exists. Refresh the folder and try again."
   );

const LOCK_UNPRESERVABLE =
   "The object is under Object Lock and the destination can't keep it. Copy it with the storage console instead.";

const carriesLock = (attributes: Partial<CopyObjectCommandInput>): boolean =>
   attributes.ObjectLockMode !== undefined ||
   attributes.ObjectLockLegalHoldStatus !== undefined;

// only a write that sent lock settings can be refused for them; a destination without Object Lock names it in a 400.
const lockRefused = (error: unknown): boolean => {
   const { httpStatus, detail } = describeFailure(error);
   return httpStatus === 400 && /object ?lock/i.test(detail);
};

const rethrowCopyFailure = (error: unknown, lockSent = false): never => {
   if (lockSent && lockRefused(error))
      throw new StorageError("conflict", LOCK_UNPRESERVABLE);
   return conflictAs(copyConflict, isUploadConflict)(error);
};

const copySourceFor = (
   bucket: string,
   { sourceBucket, sourceKey }: CopyRequest
): string => encodeCopySource(sourceBucket ?? bucket, sourceKey);

const crossBucket = (bucket: string, { sourceBucket }: CopyRequest): boolean =>
   sourceBucket !== undefined && sourceBucket !== bucket;

const rewritesInPlace = (bucket: string, request: CopyRequest): boolean =>
   request.settings !== undefined ||
   (!crossBucket(bucket, request) &&
      request.sourceKey === request.destinationKey);

// R2 destination conditions differ from CopyObject's x-amz-copy-source-if-* source conditions.
const destinationConditions = (
   provider: Provider,
   live: DestinationETag
): Record<string, string> => {
   const prefix = provider === Provider.R2 ? "cf-copy-destination-" : "";
   return live === null
      ? { [`${prefix}if-none-match`]: "*" }
      : { [`${prefix}if-match`]: live };
};

const destinationCondition = (live: DestinationETag): WriteCondition =>
   writeCondition(live ?? undefined);

const assertDestinationUnchanged = async (
   scope: S3Scope,
   key: string,
   destination: DestinationETag,
   conflictMessage?: string
): Promise<void> => {
   if (destination === null)
      return assertDestinationAbsent(
         scope,
         key,
         conflictMessage ?? OBJECT_EXISTS
      );
   if ((await headIfExists(scope, key))?.ETag !== destination)
      throw conflictMessage === undefined
         ? copyConflict()
         : new StorageError("conflict", conflictMessage);
};

const destinationETagFor = async (
   scope: S3Scope,
   provider: Provider,
   request: CopyRequest
): Promise<{ eTag: DestinationETag; comparable: boolean }> => {
   if (request.settings !== undefined)
      return { eTag: request.sourceETag, comparable: true };
   if (request.destinationETag !== undefined) {
      // storage that ignores if-match would overwrite whatever replaced the reviewed version.
      if (!enforcesConditions(provider))
         await assertDestinationUnchanged(
            scope,
            request.destinationKey,
            request.destinationETag
         );
      return { eTag: request.destinationETag, comparable: true };
   }
   if (request.overwrite === true) {
      const head = await headIfExists(scope, request.destinationKey);
      return {
         eTag: head?.ETag ?? null,
         comparable: head === null || head.ETag !== undefined,
      };
   }
   if (!enforcesConditions(provider))
      await assertDestinationAbsent(
         scope,
         request.destinationKey,
         OBJECT_EXISTS
      );
   return { eTag: null, comparable: true };
};

export {
   assertDestinationUnchanged,
   carriesLock,
   copyResult,
   copySourceFor,
   crossBucket,
   destinationCondition,
   destinationConditions,
   destinationETagFor,
   rethrowCopyFailure,
   rewritesInPlace,
};
export type { CopyRequest, CopyResult, CopySettings, DestinationETag };
