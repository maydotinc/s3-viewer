import { z } from "zod";
import { MAX_BATCH_KEYS } from "../constants";
import {
   expectedUserShape,
   isSafeKeyText,
   existingObjectKeySchema,
   existingPrefixSchema,
} from "./primitives";
import { bucketScope, uniqueKeys } from "./s3";

const MAX_MARKER_LENGTH = 1024;
export const MAX_UPLOAD_ID_CHARS = 1024;

const markerSchema = z
   .string()
   .max(MAX_MARKER_LENGTH)
   .refine(isSafeKeyText, "Invalid marker")
   .optional();

export const uploadIdSchema = z
   .string()
   .min(1)
   .max(MAX_UPLOAD_ID_CHARS)
   .refine(isSafeKeyText, "Invalid upload id");

export const multipartUploadsQuerySchema = bucketScope.extend({
   prefix: existingPrefixSchema.default(""),
   keyMarker: existingPrefixSchema.optional(),
   uploadIdMarker: markerSchema,
});
export type MultipartUploadsQuery = z.infer<typeof multipartUploadsQuerySchema>;

export const abortUploadsBodySchema = bucketScope.extend({
   ...expectedUserShape,
   uploads: z
      .array(
         z.object({ key: existingObjectKeySchema, uploadId: uploadIdSchema })
      )
      .min(1)
      .max(MAX_BATCH_KEYS)
      .refine(
         ...uniqueKeys(
            ({ uploadId }: { uploadId: string }) => uploadId,
            "Upload ids"
         )
      ),
});

export type S3MultipartUpload = {
   key: string;
   uploadId: string;
   initiated: string | null;
   storageClass: string | null;
};

export type S3MultipartUploadPage = {
   uploads: S3MultipartUpload[];
   nextKeyMarker: string | null;
   nextUploadIdMarker: string | null;
};

export type S3UploadRef = { key: string; uploadId: string };
export type S3UploadFailure = S3UploadRef & { message: string };
export type S3AbortUploadsResult = {
   aborted: S3UploadRef[];
   failed: S3UploadFailure[];
};
