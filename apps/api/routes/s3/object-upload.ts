import { uploadMemoryFor } from "@/lib/constants";
import { env } from "@/lib/env";
import { record } from "@/lib/middleware/audit-record";
import { getAuth } from "@/lib/middleware/authorize";
import { bucketRoute, byObjectKey } from "@/lib/middleware/route";
import { withUploadSlot } from "@/lib/middleware/upload-slot";
import {
   declaredLength,
   plannedPartSize,
   streamedUploadCap,
   streamUpload,
} from "@/lib/s3/upload";
import { Permission } from "@s3-viewer/permissions";
import {
   OBJECT_MUTATION_PATH,
   putObjectQuerySchema,
   type AuditEntry,
   type S3ObjectUploaded,
} from "@s3-viewer/shared";
import { Router } from "express";
import { recordedIfUnconfirmed } from "./scope";

const objectUploadRouter = Router({ mergeParams: true });

objectUploadRouter.put(
   `${OBJECT_MUTATION_PATH}/upload`,
   ...bucketRoute(
      Permission.UPLOAD_OBJECT,
      putObjectQuerySchema,
      byObjectKey,
      async (req, res, input) => {
         const { bucketName, objectKey, contentType, expectedETag } = input;
         const { userId } = getAuth(res);
         const contentLength = declaredLength(req.headers["content-length"]);
         const partSize = plannedPartSize(contentLength);
         await withUploadSlot(
            req,
            res,
            {
               userId,
               reservation: uploadMemoryFor(partSize),
               bytes: contentLength,
               bucket: bucketName,
            },
            async (abortController, client) => {
               const upload: AuditEntry = {
                  action: "object.upload",
                  bucket: bucketName,
                  target: objectKey,
                  detail: { contentType, replaced: Boolean(expectedETag) },
               };
               const { size, eTag } = await recordedIfUnconfirmed(
                  res,
                  upload,
                  () =>
                     streamUpload({
                        client,
                        bucket: bucketName,
                        key: objectKey,
                        contentType,
                        expectedETag,
                        body: req,
                        contentLength,
                        partSize,
                        maxBytes: streamedUploadCap(partSize),
                        abortController,
                        idleTimeoutMs: env.UPLOAD_IDLE_TIMEOUT_MS,
                     })
               );
               const uploaded: S3ObjectUploaded = {
                  key: objectKey,
                  size,
                  eTag,
               };
               await record(res, {
                  ...upload,
                  detail: { size, ...upload.detail },
               });
               res.status(201).json(uploaded);
            }
         );
      }
   )
);

export { objectUploadRouter };
