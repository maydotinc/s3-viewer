import {
   CompleteMultipartUploadCommand,
   CreateMultipartUploadCommand,
   UploadPartCopyCommand,
   type CompletedPart,
   type CopyObjectCommandInput,
} from "@aws-sdk/client-s3";
import { MIB, Provider, mapLimit } from "@s3-viewer/shared";
import {
   conditionHeaders,
   UnconfirmedWriteError,
   unconfirmedOnceSent,
   withRequestHeaders,
} from "./conditions";
import { retainCopyString } from "./copy-attributes";
import {
   assertDestinationUnchanged,
   carriesLock,
   copyResult,
   copySourceFor,
   destinationCondition,
   rethrowCopyFailure,
   type CopyRequest,
   type CopyResult,
   type DestinationETag,
} from "./copy-request";
import { withCopySlot } from "./copy-slots";
import { requirePartETag, StorageError } from "./errors";
import type { S3Scope } from "./listing";
import { abortForCleanup } from "./multipart-abort";
import { forPartCopies } from "./no-retry";
import { metadataAttributes } from "./object-metadata";
import { minPartSizeFor } from "./part-size";
import type { ReadReservation } from "./read-budget";
import { withReleased } from "./response-collector";

const MIN_COPY_PART_BYTES = 512 * MIB;
const COPY_CONCURRENCY = 4;

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
   const initiation = await client
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
      .catch((error: unknown) =>
         rethrowCopyFailure(error, carriesLock(attributes))
      );
   let uploadId = initiation.UploadId;
   try {
      uploadId = withReleased(initiation, () => {
         if (!initiation.UploadId)
            throw new StorageError(
               "upstream",
               "Storage did not start the multipart copy"
            );
         return retainCopyString(scope, retained, initiation.UploadId);
      });
      const parts = await mapLimit(
         partRanges(size),
         COPY_CONCURRENCY,
         async ({ start, end }, index): Promise<CompletedPart> => {
            const part = await withCopySlot(client, signal, () =>
               forPartCopies(client).send(
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
               )
            );
            return withReleased(part, () => ({
               PartNumber: index + 1,
               ETag: retainCopyString(
                  scope,
                  retained,
                  requirePartETag(part.CopyPartResult?.ETag)
               ),
            }));
         },
         // stop new work first; aborting before siblings settle can orphan their parts.
         { settle: true }
      );
      if (provider !== Provider.S3 && recheckDestination)
         await assertDestinationUnchanged(scope, destinationKey, destination);
      const complete = new CompleteMultipartUploadCommand({
         Bucket: bucket,
         Key: destinationKey,
         UploadId: uploadId,
         MultipartUpload: { Parts: parts },
         ...(provider === Provider.S3 ? destinationCondition(destination) : {}),
      });
      const unconfirmed = unconfirmedOnceSent(complete);
      const completed = await client
         .send(complete, { abortSignal: signal })
         .catch((error: unknown) => {
            throw unconfirmed(error);
         });
      return withReleased(completed, () => copyResult(completed.ETag, size));
   } catch (error) {
      // aborting could race a commit storage may already have taken.
      if (uploadId && !(error instanceof UnconfirmedWriteError))
         await abortForCleanup({ client, bucket }, destinationKey, uploadId);
      return rethrowCopyFailure(error);
   }
};

export { MIN_COPY_PART_BYTES, multipartCopy, partRanges };
