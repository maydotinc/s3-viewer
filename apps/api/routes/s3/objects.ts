import { S3_ROUTE_TIMEOUT_MS } from "@/lib/constants";
import { env } from "@/lib/env";
import { ApiHttpError, fail, requestSignal } from "@/lib/http";
import { requireExpectedUser } from "@/lib/middleware/expected-user";
import { existsLimit } from "@/lib/middleware/rate-limit";
import { bucketRoute } from "@/lib/middleware/route";
import { input } from "@/lib/middleware/validate";
import { getS3Client } from "@/lib/s3/client-cache";
import { deleteKeys } from "@/lib/s3/delete";
import { throwHttpError } from "@/lib/s3/errors";
import { whichExist } from "@/lib/s3/existence";
import {
   contentDispositionFilename,
   inlineContentType,
   inlineDisposition,
} from "@/lib/s3/keys";
import { listKeysPage, listPage, type S3Scope } from "@/lib/s3/listing";
import { renameUnavailableError } from "@/lib/s3/rename";
import { assertReplacementSupported } from "@/lib/s3/replacement-settings";
import { clientProvider } from "@/lib/s3/provider";
import { presignedUrl } from "@/lib/s3/presign";
import { recordAudit } from "@/lib/services/audit";
import {
   declaredLength,
   exceedsLimit,
   exceedsMaxPartSize,
   exceedsObjectLimit,
   isUploadTooLargeError,
   MAX_OBJECT_BYTES,
   MAX_PARTS,
   maxPartBytesFor,
   partSizeFor,
   streamUpload,
   UploadIdleError,
} from "@/lib/s3/upload";
import { createUploadBudget, uploadMemoryFor } from "@/lib/s3/upload-budget";
import {
   GetObjectCommand,
   HeadObjectCommand,
   type HeadObjectCommandOutput,
   type S3Client,
} from "@aws-sdk/client-s3";
import { Permission } from "@s3-viewer/permissions";
import {
   DEFAULT_CONTENT_TYPE,
   OBJECT_MUTATION_PATH,
   deleteObjectsBodySchema,
   type DeleteObjectsInput,
   keysQuerySchema,
   listObjectsQuerySchema,
   objectKeysBodySchema,
   objectScope,
   putObjectQuerySchema,
   renameObjectBodySchema,
   type KeysQuery,
   type ListObjectsQuery,
   type ObjectKeysInput,
   type ObjectScope,
   type PutObjectQuery,
   type RenameObjectInput,
   type S3DeleteResult,
   type S3ObjectMetadata,
   type S3ObjectPreview,
   type S3ObjectUploaded,
} from "@s3-viewer/types";
import { Router, type RequestHandler, type Response } from "express";

const objectsRouter = Router({ mergeParams: true });
const uploadBudget = createUploadBudget({
   maxUploads: env.MAX_CONCURRENT_UPLOADS,
   maxPerUser: env.MAX_USER_UPLOADS,
   maxBytes: env.UPLOAD_MEMORY_BUDGET_BYTES,
});

const routeScope = (
   client: S3Client,
   bucket: string,
   res: Response
): S3Scope => ({
   client,
   bucket,
   signal: requestSignal(res, S3_ROUTE_TIMEOUT_MS),
});

const headObject = (
   { client, bucket, signal }: S3Scope,
   key: string
): Promise<HeadObjectCommandOutput> =>
   client
      .send(new HeadObjectCommand({ Bucket: bucket, Key: key }), {
         abortSignal: signal,
      })
      .catch(throwHttpError);

const toMetadata = (head: HeadObjectCommandOutput): S3ObjectMetadata => ({
   contentType: head.ContentType ?? DEFAULT_CONTENT_TYPE,
   contentLength: head.ContentLength ?? 0,
   lastModified: head.LastModified?.toISOString() ?? null,
   storageClass: head.StorageClass ?? null,
   eTag: head.ETag ?? null,
});

const sendDeleteResult = (res: Response, result: S3DeleteResult): void => {
   res.status(result.failed.length > 0 ? 207 : 200).json(result);
};

objectsRouter.get(
   "/",
   ...bucketRoute(
      Permission.LIST_OBJECTS,
      listObjectsQuerySchema,
      async (req, res) => {
         const { serverId, bucketName, prefix, continuationToken, blockSize } =
            input<ListObjectsQuery>(res);
         const client = await getS3Client(serverId, bucketName);
         res.json(
            await listPage({
               ...routeScope(client, bucketName, res),
               prefix,
               continuationToken,
               blockSize,
            })
         );
      }
   )
);

// only the upload flow asks this, so it carries the upload permission rather
// than the far broader LIST_OBJECTS a viewer holds
objectsRouter.post(
   "/exists",
   existsLimit,
   ...bucketRoute(
      Permission.UPLOAD_OBJECT,
      objectKeysBodySchema,
      async (req, res) => {
         const { serverId, bucketName, objectKeys } =
            input<ObjectKeysInput>(res);
         const client = await getS3Client(serverId, bucketName);
         res.json(
            await whichExist(routeScope(client, bucketName, res), objectKeys)
         );
      }
   )
);

objectsRouter.get(
   "/download-url",
   ...bucketRoute(Permission.DOWNLOAD_OBJECT, objectScope, async (req, res) => {
      const { serverId, bucketName, objectKey } = input<ObjectScope>(res);
      const client = await getS3Client(serverId, bucketName);
      const command = new GetObjectCommand({
         Bucket: bucketName,
         Key: objectKey,
         ResponseContentDisposition: contentDispositionFilename(objectKey),
      });
      res.json(await presignedUrl(client, command));
   })
);

objectsRouter.get(
   "/preview-url",
   ...bucketRoute(Permission.DOWNLOAD_OBJECT, objectScope, async (req, res) => {
      const { serverId, bucketName, objectKey } = input<ObjectScope>(res);
      const client = await getS3Client(serverId, bucketName);
      const metadata = toMetadata(
         await headObject({ client, bucket: bucketName }, objectKey)
      );
      const command = new GetObjectCommand({
         Bucket: bucketName,
         Key: objectKey,
         ResponseContentType: inlineContentType(metadata.contentType),
         ResponseContentDisposition: inlineDisposition(metadata.contentType),
      });
      const preview: S3ObjectPreview & S3ObjectMetadata = {
         ...(await presignedUrl(client, command)),
         ...metadata,
      };
      res.json(preview);
   })
);

const rejectLegacyMutation: RequestHandler = (req, res) => {
   if (req.method === "PUT") res.setHeader("Connection", "close");
   fail(
      res,
      409,
      "This action needs the updated app. Refresh the page and try again."
   );
};

objectsRouter.put(["/", "/upload"], rejectLegacyMutation);
objectsRouter.delete("/", rejectLegacyMutation);
objectsRouter.post("/rename", rejectLegacyMutation);

objectsRouter.put(
   `${OBJECT_MUTATION_PATH}/upload`,
   ...bucketRoute(
      Permission.UPLOAD_OBJECT,
      putObjectQuerySchema,
      async (req, res) => {
         const {
            serverId,
            bucketName,
            objectKey,
            contentType,
            expectedETag,
            expectedUserId,
         } = input<PutObjectQuery>(res);
         const userId = requireExpectedUser(res, expectedUserId);
         if (expectedETag !== undefined) {
            try {
               // Refuse unsupported replacements before regional discovery can
               // touch storage, and before buffering any request body.
               const baseClient = await getS3Client(serverId);
               assertReplacementSupported(await clientProvider(baseClient));
            } catch (error) {
               res.setHeader("Connection", "close");
               throw error;
            }
         }
         const contentLength = declaredLength(req.headers["content-length"]);
         if (exceedsLimit(contentLength, env.MAX_UPLOAD_BYTES)) {
            throw new ApiHttpError(
               413,
               `Uploads are limited to ${env.MAX_UPLOAD_BYTES} bytes`
            );
         }
         if (exceedsObjectLimit(contentLength)) {
            throw new ApiHttpError(
               413,
               `Uploads are limited to ${MAX_OBJECT_BYTES} bytes`
            );
         }
         const maxPartBytes = maxPartBytesFor(env.UPLOAD_PART_BYTES);
         if (exceedsMaxPartSize(contentLength, maxPartBytes)) {
            throw new ApiHttpError(
               413,
               `Uploads over ${MAX_PARTS * maxPartBytes} bytes need a larger UPLOAD_PART_BYTES`
            );
         }

         const partSize = partSizeFor(contentLength, env.UPLOAD_PART_BYTES);
         const maxBytes = Math.min(
            env.MAX_UPLOAD_BYTES,
            MAX_PARTS * partSize,
            MAX_OBJECT_BYTES
         );

         let release: () => void;
         try {
            release = uploadBudget.acquire(userId, uploadMemoryFor(partSize));
         } catch (error) {
            res.setHeader("Connection", "close");
            if (error instanceof ApiHttpError && error.status === 429)
               res.setHeader("Retry-After", "5");
            throw error;
         }
         const abortController = new AbortController();
         const onRequestClose = () => {
            if (!req.complete) abortController.abort();
         };
         const onResponseClose = () => {
            if (!res.writableEnded) abortController.abort();
         };
         req.on("close", onRequestClose);
         res.on("close", onResponseClose);
         try {
            const client = await getS3Client(
               serverId,
               bucketName,
               abortController.signal
            );
            // The streaming watchdog only times demanded client input; a
            // socket timer would also kill healthy S3 backpressure/completion.
            req.setTimeout(0);
            const { size, eTag } = await streamUpload({
               client,
               bucket: bucketName,
               key: objectKey,
               contentType,
               expectedETag,
               body: req,
               contentLength,
               partSize,
               maxBytes,
               abortController,
               idleTimeoutMs: env.UPLOAD_IDLE_TIMEOUT_MS,
            });
            const uploaded: S3ObjectUploaded = { key: objectKey, size, eTag };
            res.status(201).json(uploaded);
         } catch (error) {
            res.setHeader("Connection", "close");
            if (isUploadTooLargeError(error))
               throw new ApiHttpError(413, error.message);
            if (error instanceof UploadIdleError)
               throw new ApiHttpError(408, error.message);
            throwHttpError(error);
         } finally {
            req.off("close", onRequestClose);
            res.off("close", onResponseClose);
            release();
         }
      }
   )
);

objectsRouter.delete(
   OBJECT_MUTATION_PATH,
   ...bucketRoute(
      Permission.DELETE_OBJECT,
      deleteObjectsBodySchema,
      async (req, res) => {
         const { serverId, bucketName, objects, expectedUserId } =
            input<DeleteObjectsInput>(res);
         const userId = requireExpectedUser(res, expectedUserId);
         const client = await getS3Client(serverId, bucketName);
         const result = await deleteKeys(
            routeScope(client, bucketName, res),
            objects
         );
         await recordAudit({
            action: "object.delete",
            actorId: userId,
            serverId,
            target: `${bucketName} (${result.deleted.length} objects)`,
         });
         sendDeleteResult(res, result);
      }
   )
);

objectsRouter.get(
   "/keys",
   ...bucketRoute(
      Permission.LIST_OBJECTS,
      keysQuerySchema,
      async (req, res) => {
         const { serverId, bucketName, prefix, continuationToken } =
            input<KeysQuery>(res);
         const client = await getS3Client(serverId, bucketName);
         res.json(
            await listKeysPage(
               routeScope(client, bucketName, res),
               prefix,
               continuationToken
            )
         );
      }
   )
);

objectsRouter.post(
   `${OBJECT_MUTATION_PATH}/rename`,
   ...bucketRoute(
      Permission.DELETE_OBJECT,
      renameObjectBodySchema,
      async (req, res) => {
         const { expectedUserId } = input<RenameObjectInput>(res);
         requireExpectedUser(res, expectedUserId);
         throw renameUnavailableError();
      }
   )
);

export { objectsRouter };
