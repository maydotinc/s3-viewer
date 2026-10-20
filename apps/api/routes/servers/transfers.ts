import { S3_ROUTE_TIMEOUT_MS, uploadMemoryFor } from "@/lib/constants";
import { env } from "@/lib/env";
import { ApiHttpError, asyncHandler, requestSignal } from "@/lib/http";
import { record, recordManyFor } from "@/lib/middleware/audit-record";
import {
   assertInFolders,
   authorizeBucket,
   getAuth,
   guardedGrant,
   requireUser,
   type AuthContext,
} from "@/lib/middleware/authorize";
import { requireExpectedUser } from "@/lib/middleware/expected-user";
import { withUploadSlot } from "@/lib/middleware/upload-slot";
import { input, validate } from "@/lib/middleware/validate";
import { getS3Client } from "@/lib/s3/client-cache";
import { copyObject } from "@/lib/s3/copy";
import { guardFolders } from "@/lib/s3/folder-guard";
import { headObject } from "@/lib/s3/head";
import type { S3Scope } from "@/lib/s3/listing";
import { withoutRetries } from "@/lib/s3/no-retry";
import { headReviewed } from "@/lib/s3/object-metadata";
import { partSizeFor } from "@/lib/s3/part-size";
import { clientProvider } from "@/lib/s3/provider";
import { transferObject } from "@/lib/s3/transfer";
import { streamedUploadCap } from "@/lib/s3/upload";
import { copyScope, readScope, recordedIfUnconfirmed } from "@/routes/s3/scope";
import { Permission } from "@s3-viewer/permissions";
import {
   ErrorCode,
   TRANSFERS_PATH,
   transferObjectBodySchema,
   type AuditEntry,
   type S3ObjectUploaded,
   type TransferObjectInput,
} from "@s3-viewer/types";
import {
   Router,
   type Request,
   type RequestHandler,
   type Response,
} from "express";

const transfersRouter: Router = Router();

// destination authorization replaces res.locals.auth; retain the source context.
type TransferScope = TransferObjectInput & {
   sourceAuth: AuthContext;
};

const authorizeTransfer: RequestHandler = asyncHandler(
   async (req, res, next) => {
      const user = requireUser(req);
      const scope = input<TransferObjectInput>(res);
      const { serverId, source, destination } = scope;
      // settled in order, so a source refusal is still the one answered and recorded.
      const [sourceResult, destinationResult] = await Promise.allSettled([
         authorizeBucket(
            user.id,
            serverId,
            source.bucketName,
            Permission.DOWNLOAD_OBJECT
         ),
         authorizeBucket(
            user.id,
            destination.serverId,
            destination.bucketName,
            Permission.UPLOAD_OBJECT
         ),
      ]);
      if (sourceResult.status === "rejected") throw sourceResult.reason;
      const sourceAuth = sourceResult.value;
      assertInFolders(
         sourceAuth,
         source.bucketName,
         Permission.DOWNLOAD_OBJECT,
         [source.objectKey]
      );
      if (destinationResult.status === "rejected")
         throw destinationResult.reason;
      const destinationAuth = destinationResult.value;
      assertInFolders(
         destinationAuth,
         destination.bucketName,
         Permission.UPLOAD_OBJECT,
         [destination.objectKey]
      );
      res.locals.auth = destinationAuth;
      res.locals.input = {
         ...scope,
         serverId: destination.serverId,
         sourceAuth,
      } satisfies TransferScope;
      guardFolders(
         [
            guardedGrant(sourceAuth, source.bucketName),
            guardedGrant(destinationAuth, destination.bucketName),
         ],
         next
      );
   }
);

// AWS CopyObject runs in the destination bucket's region.
const copyAcrossBuckets = async (
   res: Response,
   { sourceAuth, source, destination, overwrite }: TransferScope
): Promise<S3ObjectUploaded> => {
   const signal = requestSignal(res, S3_ROUTE_TIMEOUT_MS);
   signal.throwIfAborted();
   const sourceScope: S3Scope = {
      client: await getS3Client(sourceAuth, source.bucketName, signal),
      bucket: source.bucketName,
      signal,
   };
   const head = source.expectedETag
      ? await headReviewed(sourceScope, source.objectKey, source.expectedETag)
      : await headObject(sourceScope, source.objectKey);
   const sourceETag = source.expectedETag ?? head.ETag;
   if (!sourceETag)
      throw new ApiHttpError(
         409,
         "The file has no ETag, so it can't be copied."
      );
   const destinationRead = await readScope(destination.bucketName, res, signal);
   const { client } = destinationRead;
   const destinationScope: S3Scope = {
      ...destinationRead,
      client: withoutRetries(client),
   };
   const { eTag, size } = await copyObject(
      copyScope(destinationScope, res, head),
      await clientProvider(client),
      {
         sourceBucket: source.bucketName,
         sourceClient: sourceScope.client,
         sourceKey: source.objectKey,
         destinationKey: destination.objectKey,
         source: head,
         sourceETag,
         overwrite,
      }
   );
   return { key: destination.objectKey, size, eTag };
};

const streamAcrossServers = async (
   req: Request,
   res: Response,
   { sourceAuth, source, destination, overwrite }: TransferScope
): Promise<S3ObjectUploaded> => {
   const signal = requestSignal(res, S3_ROUTE_TIMEOUT_MS);
   signal.throwIfAborted();
   const sourceClient = await getS3Client(
      sourceAuth,
      source.bucketName,
      signal
   );
   const head = await headReviewed(
      { client: sourceClient, bucket: source.bucketName, signal },
      source.objectKey,
      source.expectedETag
   );
   const { ContentLength } = head;
   const partSize = partSizeFor(ContentLength, env.UPLOAD_PART_BYTES);
   const maxBytes = streamedUploadCap(partSize);
   if ((ContentLength ?? 0) > maxBytes)
      throw new ApiHttpError(413, `Transfers are limited to ${maxBytes} bytes`);
   return withUploadSlot(
      req,
      res,
      {
         userId: getAuth(res).userId,
         reservation: uploadMemoryFor(partSize),
         bytes: ContentLength,
         admissionErrorCode: ErrorCode.TRANSFER_NOT_STARTED,
         bucket: destination.bucketName,
      },
      async (abortController, destinationClient) => {
         const { size, eTag } = await transferObject({
            source: {
               client: sourceClient,
               bucket: source.bucketName,
               key: source.objectKey,
               expectedETag: source.expectedETag,
               head,
            },
            destination: {
               client: destinationClient,
               bucket: destination.bucketName,
               key: destination.objectKey,
            },
            overwrite,
            partSize,
            maxBytes,
            abortController,
            idleTimeoutMs: env.UPLOAD_IDLE_TIMEOUT_MS,
         });
         return { key: destination.objectKey, size, eTag };
      }
   );
};

const runTransfer = async (req: Request, res: Response): Promise<void> => {
   const scope = input<TransferScope>(res);
   requireExpectedUser(res, scope.expectedUserId);
   const { sourceAuth, source, destination } = scope;
   const sourceServerId = sourceAuth.serverId;
   await recordManyFor(requireUser(req), sourceServerId, sourceAuth.audit, [
      {
         action: "object.download",
         bucket: source.bucketName,
         target: source.objectKey,
         detail: {
            outcome: "attempt",
            toServerId: destination.serverId,
            toBucket: destination.bucketName,
         },
      },
   ]);
   const transferred: AuditEntry = {
      action: "object.transfer",
      bucket: destination.bucketName,
      target: destination.objectKey,
      detail: {
         fromServerId: sourceServerId,
         fromBucket: source.bucketName,
         from: source.objectKey,
      },
   };
   const uploaded =
      sourceServerId === destination.serverId
         ? await recordedIfUnconfirmed(res, transferred, () =>
              copyAcrossBuckets(res, scope)
           )
         : await streamAcrossServers(req, res, scope);
   await record(res, transferred);
   res.status(201).json(uploaded);
};

transfersRouter.post(
   `/:serverId${TRANSFERS_PATH}`,
   validate(transferObjectBodySchema),
   authorizeTransfer,
   asyncHandler(runTransfer)
);

export { transfersRouter };
