import { env, MAX_UPLOAD_PART_BYTES } from "@/lib/env";
import { ApiHttpError, noContent } from "@/lib/http";
import { bucketRoute } from "@/lib/middleware/route";
import { input } from "@/lib/middleware/validate";
import { getS3Client } from "@/lib/s3/client-cache";
import { deleteKeys } from "@/lib/s3/delete";
import { isNotFound, throwHttpError, toHttpError } from "@/lib/s3/errors";
import { contentDispositionFilename, encodeCopySource } from "@/lib/s3/keys";
import { listKeysPage, listPage } from "@/lib/s3/listing";
import { presignedUrl } from "@/lib/s3/presign";
import {
   declaredLength,
   exceedsLimit,
   exceedsMaxPartSize,
   isUploadTooLargeError,
   MAX_OBJECT_BYTES,
   MAX_PARTS,
   partSizeFor,
   streamUpload,
} from "@/lib/s3/upload";
import {
   CopyObjectCommand,
   DeleteObjectCommand,
   GetObjectCommand,
   HeadObjectCommand,
   type HeadObjectCommandOutput,
   type S3Client,
} from "@aws-sdk/client-s3";
import { Permission } from "@s3-viewer/permissions";
import {
   DEFAULT_CONTENT_TYPE,
   MAX_RENAME_BYTES,
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

const objectsRouter = Router({ mergeParams: true });

const headObject = (
   client: S3Client,
   bucket: string,
   key: string
): Promise<HeadObjectCommandOutput> =>
   client
      .send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
      .catch(throwHttpError);

const objectExists = async (
   client: S3Client,
   bucket: string,
   key: string
): Promise<boolean> => {
   try {
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return true;
   } catch (err) {
      if (isNotFound(err)) return false;
      throw toHttpError(err);
   }
};

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
               client,
               bucket: bucketName,
               prefix,
               continuationToken,
               blockSize,
            })
         );
      }
   )
);

objectsRouter.get(
   "/metadata",
   ...bucketRoute(Permission.LIST_OBJECTS, objectScope, async (req, res) => {
      const { serverId, bucketName, objectKey } = input<ObjectScope>(res);
      const client = await getS3Client(serverId);
      res.json(toMetadata(await headObject(client, bucketName, objectKey)));
   })
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
         const found = await mapLimit(objectKeys, HEAD_CONCURRENCY, (key) =>
            objectExists(client, bucketName, key)
         );
         const result: S3ObjectsExist = {
            existing: objectKeys.filter((_, i) => found[i]),
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
      const { contentType, contentLength } = toMetadata(
         await headObject(client, bucketName, objectKey)
      );
      const command = new GetObjectCommand({
         Bucket: bucketName,
         Key: objectKey,
         ResponseContentType: contentType,
         ResponseContentDisposition: "inline",
      });
      const preview: S3ObjectPreview = {
         ...(await presignedUrl(client, command)),
         contentType,
         contentLength,
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
         if (exceedsMaxPartSize(contentLength, MAX_UPLOAD_PART_BYTES)) {
            throw new ApiHttpError(
               413,
               `Uploads are limited to ${MAX_OBJECT_BYTES} bytes`
            );
         }

         const abortController = new AbortController();
         req.on("close", () => {
            if (!req.complete) abortController.abort();
         });

         const partSize = partSizeFor(contentLength, env.UPLOAD_PART_BYTES);
         const maxBytes = Math.min(
            env.MAX_UPLOAD_BYTES ?? Number.POSITIVE_INFINITY,
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
         const client = await getS3Client(serverId);
         sendDeleteResult(
            res,
            await deleteKeys(client, bucketName, objectKeys)
         );
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
            await listKeysPage(client, bucketName, prefix, continuationToken)
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
         const client = await getS3Client(serverId);

         const source = await headObject(client, bucketName, objectKey);
         if ((source.ContentLength ?? 0) > MAX_RENAME_BYTES) {
            throw new ApiHttpError(413, "Objects over 5 GB can't be renamed");
         }
         if (await objectExists(client, bucketName, newObjectKey)) {
            throw new ApiHttpError(
               409,
               "An object with that name already exists"
            );
         }

         await client
            .send(
               new CopyObjectCommand({
                  Bucket: bucketName,
                  Key: newObjectKey,
                  CopySource: encodeCopySource(bucketName, objectKey),
                  MetadataDirective: "COPY",
               })
            )
            .catch(throwHttpError);
         await client
            .send(
               new DeleteObjectCommand({ Bucket: bucketName, Key: objectKey })
            )
            .catch(throwHttpError);
         noContent(res);
      }
   )
);

export { objectsRouter };
