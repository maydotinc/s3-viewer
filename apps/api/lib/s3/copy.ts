import { OBJECT_EXISTS } from "@/lib/constants";
import { ApiHttpError } from "@/lib/http";
import {
   CompleteMultipartUploadCommand,
   CopyObjectCommand,
   CreateMultipartUploadCommand,
   PutObjectCommand,
   UploadPartCopyCommand,
   type CompletedPart,
   type CopyObjectCommandInput,
   type CreateMultipartUploadCommandOutput,
   type HeadObjectCommandOutput,
   type S3Client,
} from "@aws-sdk/client-s3";
import { GIB, MIB, Provider, mapLimit } from "@s3-viewer/types";
import {
   assertDestinationAbsent,
   conditionHeaders,
   conflictAs,
   uploadConflict,
   withRequestHeaders,
   writeCondition,
   type WriteCondition,
} from "./conditions";
import { encodeCopySource } from "./keys";
import { headIfExists } from "./head";
import type { S3Scope } from "./listing";
import { abortForCleanup } from "./multipart-uploads";
import { aclAttributes, readObjectAcl } from "./object-acl";
import { destinationAcceptsAcl } from "./bucket-ownership";
import { metadataAttributes, redirectAttributes } from "./object-metadata";
import { readObjectTagging, taggingOf } from "./object-tagging";
import { minPartSizeFor } from "./part-size";
import {
   BUFFER_MEMORY_FACTOR,
   copyRetainedString,
   readBudget,
   retainForResponse,
   type ReadReservation,
} from "./read-budget";
import { budgetServerOf } from "./request-budget";
import { releaseBufferedResponse } from "./response-collector";

const MAX_SINGLE_COPY_BYTES = 5 * GIB;
const MIN_COPY_PART_BYTES = 512 * MIB;
const COPY_CONCURRENCY = 4;
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

const retainedCopyResult = (
   scope: S3Scope,
   eTag: string | undefined,
   size: number
): CopyResult => {
   if (eTag === undefined) return { eTag: null, size };
   retainForResponse(reserveCopyString(scope, eTag));
   return { eTag: copyRetainedString(eTag), size };
};

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

const copyConflictError = () =>
   new ApiHttpError(
      409,
      "The original changed or the destination already exists. Refresh the folder and try again."
   );

const throwCopyError = conflictAs(copyConflictError, uploadConflict);

// cross-bucket copies use destination encryption defaults because KMS keys are region and policy specific.
const copyAttributes = (
   head: HeadObjectCommandOutput,
   crossBucket: boolean
): Partial<CopyObjectCommandInput> => ({
   ...redirectAttributes(head),
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

const destinationETagFor = async (
   scope: S3Scope,
   provider: Provider,
   request: CopyRequest
): Promise<{ eTag: DestinationETag; comparable: boolean }> => {
   if (request.settings !== undefined)
      return { eTag: request.sourceETag, comparable: true };
   if (request.destinationETag !== undefined)
      return { eTag: request.destinationETag, comparable: true };
   if (request.overwrite === true) {
      const head = await headIfExists(scope, request.destinationKey);
      return {
         eTag: head?.ETag ?? null,
         comparable: head === null || head.ETag !== undefined,
      };
   }
   if (provider !== Provider.S3)
      await assertDestinationAbsent(
         scope,
         request.destinationKey,
         OBJECT_EXISTS
      );
   return { eTag: null, comparable: true };
};

const assertDestinationUnchanged = async (
   scope: S3Scope,
   key: string,
   destination: DestinationETag
): Promise<void> => {
   if (destination === null)
      return assertDestinationAbsent(scope, key, OBJECT_EXISTS);
   if ((await headIfExists(scope, key))?.ETag !== destination)
      throw copyConflictError();
};

const GRANTS_UNPRESERVABLE =
   "The object's access permissions could not be preserved. Refresh and try again.";

const grantAttributes = async (
   scope: S3Scope,
   provider: Provider,
   { sourceClient = scope.client, sourceKey }: CopyRequest,
   bucket: string,
   strict: boolean,
   retained: ReadReservation[]
): Promise<Partial<CopyObjectCommandInput>> => {
   if (provider !== Provider.S3) return {};
   try {
      const output = await readObjectAcl(
         { ...scope, client: sourceClient, bucket },
         sourceKey
      );
      try {
         return Object.fromEntries(
            Object.entries(aclAttributes(output)).map(([field, value]) => [
               field,
               typeof value === "string"
                  ? retainCopyString(scope, retained, value)
                  : value,
            ])
         );
      } finally {
         releaseBufferedResponse(output);
      }
   } catch (error) {
      if (!strict) return {};
      if (error instanceof ApiHttpError) throw error;
      throw new ApiHttpError(409, GRANTS_UNPRESERVABLE);
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
      try {
         const tagging = taggingOf(output.TagSet);
         return tagging === undefined
            ? undefined
            : retainCopyString(scope, retained, tagging);
      } finally {
         releaseBufferedResponse(output);
      }
   } catch (error) {
      if (!strict) return undefined;
      return throwCopyError(error);
   }
};

const singleCopy = async (
   scope: S3Scope,
   provider: Provider,
   request: CopyRequest,
   attributes: Partial<CopyObjectCommandInput>,
   destination: DestinationETag
): Promise<CopyResult> => {
   const { client, bucket, signal } = scope;
   const { destinationKey, source, sourceETag, settings } = request;
   const output = await client
      .send(
         withRequestHeaders(
            new CopyObjectCommand({
               Bucket: bucket,
               Key: destinationKey,
               CopySource: copySourceFor(bucket, request),
               CopySourceIfMatch: sourceETag,
               ...(settings
                  ? { MetadataDirective: "REPLACE", ...settings }
                  : { MetadataDirective: "COPY" }),
               ...attributes,
            }),
            destinationConditions(provider, destination)
         ),
         { abortSignal: signal }
      )
      .catch(throwCopyError);
   try {
      return retainedCopyResult(
         scope,
         output.CopyObjectResult?.ETag,
         source.ContentLength ?? 0
      );
   } finally {
      releaseBufferedResponse(output);
   }
};

const partRanges = (size: number): { start: number; end: number }[] => {
   const partBytes = Math.max(MIN_COPY_PART_BYTES, minPartSizeFor(size));
   const ranges: { start: number; end: number }[] = [];
   for (let start = 0; start < size; start += partBytes)
      ranges.push({ start, end: Math.min(start + partBytes, size) - 1 });
   return ranges;
};

const multipartCopy = async (
   scope: S3Scope,
   provider: Provider,
   request: CopyRequest,
   attributes: Partial<CopyObjectCommandInput>,
   tagging: string | undefined,
   destination: DestinationETag,
   recheckDestination: boolean,
   retained: ReadReservation[]
): Promise<CopyResult> => {
   const { client, bucket, signal } = scope;
   const { destinationKey, source, sourceETag, settings } = request;
   const size = source.ContentLength ?? 0;
   const copySource = copySourceFor(bucket, request);
   let initiation: CreateMultipartUploadCommandOutput | undefined = await client
      .send(
         withRequestHeaders(
            new CreateMultipartUploadCommand({
               Bucket: bucket,
               Key: destinationKey,
               ...(settings ?? metadataAttributes(source)),
               ...attributes,
               ...(tagging ? { Tagging: tagging } : {}),
            }),
            provider === Provider.S3
               ? {}
               : conditionHeaders(destinationCondition(destination))
         ),
         { abortSignal: signal }
      )
      .catch(throwCopyError);
   let uploadId = initiation.UploadId;
   try {
      if (!uploadId)
         throw new ApiHttpError(
            502,
            "Storage did not start the multipart copy"
         );
      uploadId = retainCopyString(scope, retained, uploadId);
      releaseBufferedResponse(initiation);
      initiation = undefined;
      const parts = await mapLimit(
         partRanges(size),
         COPY_CONCURRENCY,
         async ({ start, end }, index): Promise<CompletedPart> => {
            signal?.throwIfAborted();
            const part = await client.send(
               new UploadPartCopyCommand({
                  Bucket: bucket,
                  Key: destinationKey,
                  UploadId: uploadId,
                  PartNumber: index + 1,
                  CopySource: copySource,
                  CopySourceRange: `bytes=${start}-${end}`,
                  CopySourceIfMatch: sourceETag,
               }),
               { abortSignal: signal }
            );
            try {
               const eTag = part.CopyPartResult?.ETag;
               if (!eTag)
                  throw new ApiHttpError(502, "Storage returned no part ETag.");
               return {
                  PartNumber: index + 1,
                  ETag: retainCopyString(scope, retained, eTag),
               };
            } finally {
               releaseBufferedResponse(part);
            }
         },
         // stop new work first; aborting before siblings settle can orphan their parts.
         { settle: true }
      );
      if (provider !== Provider.S3 && recheckDestination)
         await assertDestinationUnchanged(scope, destinationKey, destination);
      const completed = await client.send(
         new CompleteMultipartUploadCommand({
            Bucket: bucket,
            Key: destinationKey,
            UploadId: uploadId,
            MultipartUpload: { Parts: parts },
            ...(provider === Provider.S3
               ? destinationCondition(destination)
               : {}),
         }),
         { abortSignal: signal }
      );
      try {
         return retainedCopyResult(scope, completed.ETag, size);
      } finally {
         releaseBufferedResponse(completed);
      }
   } catch (error) {
      if (uploadId)
         await abortForCleanup({ client, bucket }, destinationKey, uploadId);
      return throwCopyError(error);
   } finally {
      if (initiation) releaseBufferedResponse(initiation);
   }
};

const copyObject = async (
   scope: S3Scope,
   provider: Provider,
   request: CopyRequest
): Promise<CopyResult> => {
   if (request.source.SSECustomerAlgorithm)
      throw new ApiHttpError(
         409,
         "This object is encrypted with a customer-provided key and can't be copied without the customer key."
      );
   if (
      provider === Provider.R2 &&
      (request.source.ContentLength ?? 0) > MAX_SINGLE_COPY_BYTES
   )
      throw new ApiHttpError(
         409,
         "R2 objects larger than 5 GiB cannot be copied, renamed, or have their settings changed safely."
      );
   const retained: ReadReservation[] = [];
   try {
      const { eTag: destination, comparable } = await destinationETagFor(
         scope,
         provider,
         request
      );
      const sourceBucket = request.sourceBucket ?? scope.bucket;
      const inPlace = rewritesInPlace(scope.bucket, request);
      const preserveGrants =
         provider !== Provider.S3 ||
         !crossBucket(scope.bucket, request) ||
         (await destinationAcceptsAcl(scope));
      const attributes = {
         ...copyAttributes(request.source, crossBucket(scope.bucket, request)),
         ...(preserveGrants
            ? await grantAttributes(
                 scope,
                 provider,
                 request,
                 sourceBucket,
                 inPlace,
                 retained
              )
            : {}),
      };
      if ((request.source.ContentLength ?? 0) <= MAX_SINGLE_COPY_BYTES)
         return await singleCopy(
            scope,
            provider,
            request,
            attributes,
            destination
         );
      const tagging =
         provider !== Provider.R2
            ? await sourceTagging(
                 scope,
                 request,
                 sourceBucket,
                 inPlace,
                 retained
              )
            : undefined;
      return await multipartCopy(
         scope,
         provider,
         request,
         attributes,
         tagging,
         destination,
         comparable,
         retained
      );
   } finally {
      for (const reservation of retained) reservation.release();
   }
};

const createFolder = async (
   scope: S3Scope,
   provider: Provider,
   folderKey: string
): Promise<void> => {
   if (provider !== Provider.S3)
      await assertDestinationAbsent(scope, folderKey, OBJECT_EXISTS);
   await scope.client
      .send(
         new PutObjectCommand({
            Bucket: scope.bucket,
            Key: folderKey,
            Body: "",
            ContentLength: 0,
            IfNoneMatch: "*",
         }),
         { abortSignal: scope.signal }
      )
      .catch(conflictAs(() => new ApiHttpError(409, OBJECT_EXISTS)));
};

export { MIN_COPY_PART_BYTES, copyObject, createFolder, partRanges };
export type { CopySettings, CopyRequest };
