import {
   MAX_EXISTS_HEADS,
   OBJECT_EXISTS,
   S3_ROUTE_TIMEOUT_MS,
} from "@/lib/constants";
import { env } from "@/lib/env";
import { ApiHttpError, noContent, requestSignal } from "@/lib/http";
import { logger } from "@/lib/logger";
import { getAuth } from "@/lib/middleware/authorize";
import { bucketRoute } from "@/lib/middleware/route";
import { input } from "@/lib/middleware/validate";
import { getS3Client } from "@/lib/s3/client-cache";
import { deleteKeys } from "@/lib/s3/delete";
import { isNotFound, throwHttpError, toHttpError } from "@/lib/s3/errors";
import {
   contentDispositionFilename,
   encodeCopySource,
   inlineContentType,
   inlineDisposition,
} from "@/lib/s3/keys";
import {
   existingKeys,
   listKeysPage,
   listPage,
   type S3Scope,
} from "@/lib/s3/listing";
import { presignedUrl } from "@/lib/s3/presign";
import { recordAudit } from "@/lib/services/audit";
import { loadServerSettings } from "@/lib/services/servers";
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
} from "@/lib/s3/upload";
import {
   CopyObjectCommand,
   DeleteObjectCommand,
   GetObjectCommand,
   HeadObjectCommand,
   type CopyObjectCommandInput,
   type HeadObjectCommandOutput,
   type S3Client,
} from "@aws-sdk/client-s3";
import { Permission } from "@s3-viewer/permissions";
import {
   DEFAULT_CONTENT_TYPE,
   MAX_RENAME_BYTES,
   Provider,
   keysQuerySchema,
   listObjectsQuerySchema,
   mapLimit,
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
   type S3ObjectsExist,
} from "@s3-viewer/types";
import { Router, type Response } from "express";

const HEAD_CONCURRENCY = 16;
const EXISTS_LIST_THRESHOLD = 50;

const objectsRouter = Router({ mergeParams: true });

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

const objectExists = async (scope: S3Scope, key: string): Promise<boolean> => {
   try {
      await headObject(scope, key);
      return true;
   } catch (err) {
      if (isNotFound(err)) return false;
      throw toHttpError(err);
   }
};

const headExisting = (
   scope: S3Scope,
   keys: readonly string[]
): Promise<string[]> =>
   mapLimit(keys, HEAD_CONCURRENCY, (key) => objectExists(scope, key)).then(
      (found) => keys.filter((_, i) => found[i])
   );

// one HeadObject per key bills the bucket owner for the whole batch, so past a
// small batch the answer comes from listings and only the keys the page budget
// couldn't reach fall back to heads. past the head cap a key is reported as
// existing: the client uses this to warn before overwriting, and a spare
// "replace?" beats a silent overwrite
const whichExist = async (
   scope: S3Scope,
   keys: string[]
): Promise<string[]> => {
   if (keys.length <= EXISTS_LIST_THRESHOLD) return headExisting(scope, keys);
   const { existing, unresolved } = await existingKeys(scope, keys);
   return [
      ...existing,
      ...(await headExisting(scope, unresolved.slice(0, MAX_EXISTS_HEADS))),
      ...unresolved.slice(MAX_EXISTS_HEADS),
   ];
};

const copyAttributes = (
   head: HeadObjectCommandOutput
): Partial<CopyObjectCommandInput> => ({
   ...(head.StorageClass && { StorageClass: head.StorageClass }),
   ...(head.ServerSideEncryption && {
      ServerSideEncryption: head.ServerSideEncryption,
   }),
   ...(head.SSEKMSKeyId && { SSEKMSKeyId: head.SSEKMSKeyId }),
   ...(head.BucketKeyEnabled !== undefined && {
      BucketKeyEnabled: head.BucketKeyEnabled,
   }),
});

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
         const client = await getS3Client(serverId);
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

objectsRouter.post(
   "/exists",
   ...bucketRoute(
      Permission.LIST_OBJECTS,
      objectKeysBodySchema,
      async (req, res) => {
         const { serverId, bucketName, objectKeys } =
            input<ObjectKeysInput>(res);
         const client = await getS3Client(serverId);
         const result: S3ObjectsExist = {
            existing: await whichExist(
               routeScope(client, bucketName, res),
               objectKeys
            ),
         };
         res.json(result);
      }
   )
);

objectsRouter.get(
   "/download-url",
   ...bucketRoute(Permission.DOWNLOAD_OBJECT, objectScope, async (req, res) => {
      const { serverId, bucketName, objectKey } = input<ObjectScope>(res);
      const client = await getS3Client(serverId);
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
      const client = await getS3Client(serverId);
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

objectsRouter.put(
   "/",
   ...bucketRoute(
      Permission.UPLOAD_OBJECT,
      putObjectQuerySchema,
      async (req, res) => {
         const { serverId, bucketName, objectKey, contentType } =
            input<PutObjectQuery>(res);
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

         // a large upload can stream for hours, so this route drops the socket
         // idle timeout instead of server.ts doing it for every route
         req.setTimeout(0);

         const abortController = new AbortController();
         req.on("close", () => {
            if (!req.complete) abortController.abort();
         });

         const partSize = partSizeFor(contentLength, env.UPLOAD_PART_BYTES);
         const maxBytes = Math.min(
            env.MAX_UPLOAD_BYTES,
            MAX_PARTS * partSize,
            MAX_OBJECT_BYTES
         );

         const client = await getS3Client(serverId);
         const { size, eTag } = await streamUpload({
            client,
            bucket: bucketName,
            key: objectKey,
            contentType,
            body: req,
            contentLength,
            partSize,
            maxBytes,
            abortController,
         }).catch((err: unknown) => {
            if (isUploadTooLargeError(err)) {
               throw new ApiHttpError(413, err.message);
            }
            return throwHttpError(err);
         });
         const uploaded: S3ObjectUploaded = { key: objectKey, size, eTag };
         res.status(201).json(uploaded);
      }
   )
);

objectsRouter.delete(
   "/",
   ...bucketRoute(
      Permission.DELETE_OBJECT,
      objectKeysBodySchema,
      async (req, res) => {
         const { serverId, bucketName, objectKeys } =
            input<ObjectKeysInput>(res);
         const { userId } = getAuth(res);
         const client = await getS3Client(serverId);
         const result = await deleteKeys(
            routeScope(client, bucketName, res),
            objectKeys
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
         const client = await getS3Client(serverId);
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
   "/rename",
   ...bucketRoute(
      Permission.DELETE_OBJECT,
      renameObjectBodySchema,
      async (req, res) => {
         const { serverId, bucketName, objectKey, newObjectKey } =
            input<RenameObjectInput>(res);
         const { userId } = getAuth(res);
         const [client, { provider }] = await Promise.all([
            getS3Client(serverId),
            loadServerSettings(serverId),
         ]);
         const scope: S3Scope = { client, bucket: bucketName };

         const [source, destinationExists] = await Promise.all([
            headObject(scope, objectKey),
            objectExists(scope, newObjectKey),
         ]);
         if ((source.ContentLength ?? 0) > MAX_RENAME_BYTES) {
            throw new ApiHttpError(413, "Objects over 5 GB can't be renamed");
         }
         if (destinationExists) throw new ApiHttpError(409, OBJECT_EXISTS);

         await client
            .send(
               new CopyObjectCommand({
                  Bucket: bucketName,
                  Key: newObjectKey,
                  CopySource: encodeCopySource(bucketName, objectKey),
                  MetadataDirective: "COPY",
                  ...copyAttributes(source),
                  // only s3 itself answers 412 instead of overwriting, so the
                  // check-then-copy above stays the fallback everywhere else
                  ...(Provider[provider] === Provider.S3 && {
                     IfNoneMatch: "*",
                  }),
               })
            )
            .catch(throwHttpError);
         await client
            .send(
               new DeleteObjectCommand({ Bucket: bucketName, Key: objectKey })
            )
            .catch(async (err: unknown) => {
               // a delete that timed out may still have landed, so the copy is
               // only undone while the source is provably still there
               const sourceRemains = await objectExists(scope, objectKey).catch(
                  () => null
               );
               if (sourceRemains === false) return;
               if (sourceRemains) {
                  await client
                     .send(
                        new DeleteObjectCommand({
                           Bucket: bucketName,
                           Key: newObjectKey,
                        })
                     )
                     .catch(() =>
                        logger.warn("Rename left a copy behind", {
                           bucket: bucketName,
                           objectKey,
                           newObjectKey,
                        })
                     );
               }
               return throwHttpError(err);
            });
         await recordAudit({
            action: "object.rename",
            actorId: userId,
            serverId,
            target: `${bucketName}/${objectKey} -> ${newObjectKey}`,
         });
         noContent(res);
      }
   )
);

export { objectsRouter };
