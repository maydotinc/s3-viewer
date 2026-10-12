import { copyDeadlineMs } from "@/lib/constants";
import { env, MAX_UPLOAD_OBJECT_BYTES } from "@/lib/env";
import {
   ApiHttpError,
   noContent,
   requestSignal,
   sendPartialResult,
} from "@/lib/http";
import { record } from "@/lib/middleware/audit-record";
import {
   bucketRoute,
   byObjectKey,
   foldersCheckedInHandler,
} from "@/lib/middleware/route";
import { assertListablePrefix, getAuth } from "@/lib/middleware/authorize";
import { withUploadSlot } from "@/lib/middleware/upload-slot";
import {
   abortMultipartUpload,
   abortMultipartUploads,
   completeUpload,
   createUpload,
   listMultipartUploads,
   listUploadsInFolders,
   listUploadedParts,
   openUploadId,
   streamPart,
} from "@/lib/s3/multipart-uploads";
import { declaredLength, plannedPartSize } from "@/lib/s3/upload";
import { Permission } from "@s3-viewer/permissions";
import {
   MULTIPART_ABORT_PATH,
   MULTIPART_COMPLETE_PATH,
   MULTIPART_PART_CONTENT_TYPE,
   MULTIPART_PARTS_PATH,
   MULTIPART_UPLOADS_PATH,
   abortMultipartBodySchema,
   abortUploadsBodySchema,
   completeMultipartBodySchema,
   createMultipartBodySchema,
   multipartUploadsQuerySchema,
   uploadPartQuerySchema,
   uploadedPartsQuerySchema,
   type S3AbortUploadsResult,
   type S3UploadedParts,
} from "@s3-viewer/types";
import { Router } from "express";
import { awaitStorage, mutationScope, readScope } from "./scope";

const multipartRouter = Router({ mergeParams: true });

const openUpload = ({
   serverId,
   bucketName,
   objectKey,
   uploadId,
}: {
   serverId: string;
   bucketName: string;
   objectKey: string;
   uploadId: string;
}) => openUploadId(uploadId, { serverId, bucket: bucketName, key: objectKey });

multipartRouter.get(
   MULTIPART_UPLOADS_PATH,
   ...bucketRoute(
      Permission.LIST_OBJECTS,
      multipartUploadsQuerySchema,
      foldersCheckedInHandler,
      async (_req, res, input) => {
         const { serverId, bucketName, prefix, keyMarker, uploadIdMarker } =
            input;
         const scope = await readScope(bucketName, res);
         const auth = getAuth(res);
         const { folders } = auth;
         assertListablePrefix(
            auth,
            bucketName,
            Permission.LIST_OBJECTS,
            prefix
         );
         const query = { prefix, keyMarker, uploadIdMarker };
         res.json(
            folders === null
               ? await listMultipartUploads(scope, serverId, query)
               : await listUploadsInFolders(scope, serverId, folders, query)
         );
      }
   )
);

multipartRouter.delete(
   MULTIPART_UPLOADS_PATH,
   ...bucketRoute(
      Permission.DELETE_OBJECT,
      abortUploadsBodySchema,
      ({ uploads }) => uploads.map(({ key }) => key),
      async (_req, res, input) => {
         const { serverId, bucketName, uploads } = input;
         const scope = await readScope(bucketName, res);
         const { aborted, alreadyGone, failed } = await abortMultipartUploads(
            scope,
            serverId,
            uploads
         );
         if (aborted.length > 0) {
            await record(res, {
               action: "object.multipart_abort",
               bucket: bucketName,
               target: aborted[0]?.key ?? null,
               detail: { count: aborted.length },
            });
         }
         const result: S3AbortUploadsResult = {
            aborted: [...aborted, ...alreadyGone],
            failed,
         };
         sendPartialResult(res, result);
      }
   )
);

multipartRouter.post(
   MULTIPART_UPLOADS_PATH,
   ...bucketRoute(
      Permission.UPLOAD_OBJECT,
      createMultipartBodySchema,
      byObjectKey,
      async (_req, res, input) => {
         const {
            serverId,
            bucketName,
            objectKey,
            contentType,
            totalBytes,
            expectedETag,
         } = input;
         const partSize = plannedPartSize(totalBytes);
         const { scope, provider } = await mutationScope(bucketName, res);
         res.status(201).json(
            await createUpload(scope, provider, {
               serverId,
               key: objectKey,
               contentType,
               partSize,
               partCount: Math.ceil(totalBytes / partSize),
               expectedETag,
            })
         );
      }
   )
);

multipartRouter.put(
   MULTIPART_PARTS_PATH,
   ...bucketRoute(
      Permission.UPLOAD_OBJECT,
      uploadPartQuerySchema,
      byObjectKey,
      async (req, res, input) => {
         const { bucketName, objectKey, partNumber } = input;
         const { userId } = getAuth(res);
         const { uploadId, partSize } = openUpload(input);
         if (
            !(req.headers["content-type"] ?? "").startsWith(
               MULTIPART_PART_CONTENT_TYPE
            )
         )
            throw new ApiHttpError(
               415,
               `Parts must be sent as ${MULTIPART_PART_CONTENT_TYPE}`
            );
         const contentLength = declaredLength(req.headers["content-length"]);
         if (contentLength === undefined || contentLength === 0)
            throw new ApiHttpError(411, "Each part needs a Content-Length.");
         if (contentLength > partSize) {
            throw new ApiHttpError(
               413,
               `Parts are limited to ${partSize} bytes`
            );
         }
         if (partNumber > Math.ceil(MAX_UPLOAD_OBJECT_BYTES / partSize))
            throw new ApiHttpError(
               413,
               `Uploads are limited to ${MAX_UPLOAD_OBJECT_BYTES} bytes`
            );

         await withUploadSlot(
            req,
            res,
            {
               userId,
               reservation: contentLength,
               bytes: contentLength,
               bucket: bucketName,
            },
            async (abortController, client) => {
               res.json(
                  await streamPart(
                     {
                        client,
                        bucket: bucketName,
                        signal: abortController.signal,
                     },
                     {
                        key: objectKey,
                        uploadId,
                        partNumber,
                        body: req,
                        contentLength,
                        abortController,
                        idleTimeoutMs: env.UPLOAD_IDLE_TIMEOUT_MS,
                     }
                  )
               );
            }
         );
      }
   )
);

multipartRouter.get(
   MULTIPART_PARTS_PATH,
   ...bucketRoute(
      Permission.UPLOAD_OBJECT,
      uploadedPartsQuerySchema,
      byObjectKey,
      async (_req, res, input) => {
         const { bucketName, objectKey } = input;
         const { uploadId } = openUpload(input);
         const scope = await readScope(bucketName, res);
         const parts: S3UploadedParts = {
            parts: await listUploadedParts(scope, objectKey, uploadId),
         };
         res.json(parts);
      }
   )
);

multipartRouter.post(
   MULTIPART_COMPLETE_PATH,
   ...bucketRoute(
      Permission.UPLOAD_OBJECT,
      completeMultipartBodySchema,
      byObjectKey,
      async (_req, res, input) => {
         const { bucketName, objectKey, parts, expectedETag } = input;
         const { scope } = await mutationScope(bucketName, res);
         awaitStorage(res);
         const uploaded = await completeUpload(scope, {
            serverId: input.serverId,
            key: objectKey,
            uploadId: input.uploadId,
            parts,
            expectedETag,
            maxBytes: MAX_UPLOAD_OBJECT_BYTES,
            commitSignal: (size) => requestSignal(res, copyDeadlineMs(size)),
         });
         await record(res, {
            action: "object.upload",
            bucket: bucketName,
            target: objectKey,
            detail: {
               size: uploaded.size,
               parts: parts.length,
               replaced: Boolean(expectedETag),
            },
         });
         res.status(201).json(uploaded);
      }
   )
);

// aborting uncommitted parts requires upload permission, not permission to delete stored objects.
multipartRouter.delete(
   MULTIPART_ABORT_PATH,
   ...bucketRoute(
      Permission.UPLOAD_OBJECT,
      abortMultipartBodySchema,
      byObjectKey,
      async (_req, res, input) => {
         const { bucketName, objectKey } = input;
         const { uploadId } = openUpload(input);
         const scope = await readScope(bucketName, res);
         if (await abortMultipartUpload(scope, objectKey, uploadId))
            await record(res, {
               action: "object.multipart_abort",
               bucket: bucketName,
               target: objectKey,
               detail: { count: 1 },
            });
         noContent(res);
      }
   )
);

export { multipartRouter };
