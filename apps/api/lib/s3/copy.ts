import { OBJECT_EXISTS } from "@/lib/constants";
import {
   CopyObjectCommand,
   PutObjectCommand,
   type CopyObjectCommandInput,
} from "@aws-sdk/client-s3";
import { GIB, Provider } from "@s3-viewer/shared";
import {
   assertDestinationAbsent,
   conflictAs,
   enforcesConditions,
   unconfirmedOnceSent,
   withRequestHeaders,
} from "./conditions";
import {
   copyAttributes,
   grantAttributes,
   preservesGrants,
   sourceTagging,
} from "./copy-attributes";
import {
   carriesLock,
   copyResult,
   copySourceFor,
   crossBucket,
   destinationConditions,
   destinationETagFor,
   rethrowCopyFailure,
   rewritesInPlace,
   type CopyRequest,
   type CopyResult,
   type DestinationETag,
} from "./copy-request";
import { withCopySlot } from "./copy-slots";
import { StorageError } from "./errors";
import type { S3Scope } from "./listing";
import { multipartCopy } from "./multipart-copy";
import type { ReadReservation } from "./read-budget";
import { withReleased } from "./response-collector";

const MAX_SINGLE_COPY_BYTES = 5 * GIB;

const singleCopy = async (
   scope: S3Scope,
   provider: Provider,
   request: CopyRequest,
   attributes: Partial<CopyObjectCommandInput>,
   destination: DestinationETag
): Promise<CopyResult> => {
   const { client, bucket, signal } = scope;
   const { destinationKey, source, sourceETag, settings } = request;
   const command = withRequestHeaders(
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
   );
   const unconfirmed = unconfirmedOnceSent(command);
   const output = await withCopySlot(client, signal, () =>
      client.send(command, { abortSignal: signal })
   ).catch((error: unknown) =>
      rethrowCopyFailure(unconfirmed(error), carriesLock(attributes))
   );
   return withReleased(output, () =>
      copyResult(output.CopyObjectResult?.ETag, source.ContentLength ?? 0)
   );
};

const copyObject = async (
   scope: S3Scope,
   provider: Provider,
   request: CopyRequest
): Promise<CopyResult> => {
   if (request.source.SSECustomerAlgorithm)
      throw new StorageError(
         "conflict",
         "This object is encrypted with a customer-provided key and can't be copied without the customer key."
      );
   if (
      provider === Provider.R2 &&
      (request.source.ContentLength ?? 0) > MAX_SINGLE_COPY_BYTES
   )
      throw new StorageError(
         "conflict",
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
      const cross = crossBucket(scope.bucket, request);
      const attributes = {
         ...copyAttributes(request.source, cross),
         ...((await preservesGrants(scope, provider, cross))
            ? await grantAttributes(
                 scope,
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
      const tagging = await sourceTagging(
         scope,
         request,
         sourceBucket,
         inPlace,
         retained
      );
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
   if (!enforcesConditions(provider))
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
      .catch(conflictAs(() => new StorageError("conflict", OBJECT_EXISTS)));
};

export { copyObject, createFolder };
