import { z } from "zod";
import { MAX_MULTIPART_PARTS, MAX_OBJECT_BYTES } from "../constants";
import { uploadIdSchema } from "./multipart";
import {
   contentTypeSchema,
   expectedUserShape,
   fileKeySchema,
   isSafeKeyText,
} from "./primitives";
import { objectScope, observedETagSchema } from "./s3";

const partNumberSchema = z.coerce
   .number()
   .int()
   .min(1)
   .max(MAX_MULTIPART_PARTS);

// compatible providers return opaque, sometimes unquoted part ETags.
const partETagSchema = z
   .string()
   .min(1)
   .max(256)
   .refine(isSafeKeyText, "Invalid part ETag");

const totalBytesSchema = z.coerce.number().int().min(1).max(MAX_OBJECT_BYTES);

export const createMultipartBodySchema = objectScope.extend({
   objectKey: fileKeySchema,
   ...expectedUserShape,
   contentType: contentTypeSchema,
   totalBytes: totalBytesSchema,
   expectedETag: observedETagSchema.optional(),
});

export const uploadPartQuerySchema = objectScope.extend({
   ...expectedUserShape,
   uploadId: uploadIdSchema,
   partNumber: partNumberSchema,
});

export const uploadedPartsQuerySchema = objectScope.extend({
   uploadId: uploadIdSchema,
});

export const completeMultipartBodySchema = objectScope.extend({
   ...expectedUserShape,
   uploadId: uploadIdSchema,
   parts: z
      .array(z.object({ partNumber: partNumberSchema, eTag: partETagSchema }))
      .min(1)
      .max(MAX_MULTIPART_PARTS)
      .refine(
         (parts) =>
            parts.every(({ partNumber }, index) => partNumber === index + 1),
         "Parts must be numbered from 1 without gaps"
      ),
   expectedETag: observedETagSchema.optional(),
});

export const abortMultipartBodySchema = objectScope.extend({
   ...expectedUserShape,
   uploadId: uploadIdSchema,
});

export type S3MultipartCreated = {
   key: string;
   uploadId: string;
   partSize: number;
   partCount: number;
};

export type S3UploadedPart = { partNumber: number; eTag: string; size: number };

export type S3UploadedParts = { parts: S3UploadedPart[] };
