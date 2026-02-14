import { z } from "zod";
import {
   bucketNameSchema,
   contentTypeSchema,
   idSchema,
   objectKeySchema,
} from "./primitives";

const sid = z.string().min(1);

// Bucket schemas
export const bucketBodySchema = z.object({
   bucketName: bucketNameSchema,
   serverId: idSchema,
});
export type BucketBodyInput = z.infer<typeof bucketBodySchema>;

export const listBucketsQuerySchema = z.object({
   serverId: sid,
});
export type ListBucketsQuery = z.infer<typeof listBucketsQuerySchema>;

// Object query schemas
export const s3QueryBase = z.object({
   serverId: sid,
   bucketName: bucketNameSchema,
   objectKey: objectKeySchema,
});
export type S3QueryBase = z.infer<typeof s3QueryBase>;

export const presignUploadQuerySchema = s3QueryBase.extend({
   contentType: contentTypeSchema,
});
export type PresignUploadQuery = z.infer<typeof presignUploadQuerySchema>;

export const presignDownloadQuerySchema = s3QueryBase;
export const metadataQuerySchema = s3QueryBase;

export const previewQuerySchema = s3QueryBase.extend({
   contentType: contentTypeSchema,
});
export type PreviewQuery = z.infer<typeof previewQuerySchema>;

export const listObjectsQuerySchema = z.object({
   bucket: bucketNameSchema,
   serverId: sid,
   continuationToken: z.string().optional(),
   blockSize: z.string().regex(/^\d+$/),
   prefix: z.string().optional(),
});
export type ListObjectsQuery = z.infer<typeof listObjectsQuerySchema>;

export const multipartPartQuerySchema = z.object({
   serverId: sid,
   bucketName: bucketNameSchema,
   objectKey: objectKeySchema,
});

// Object body schemas
export const s3BodyBase = z.object({
   serverId: sid,
   bucketName: bucketNameSchema,
   objectKey: objectKeySchema,
});
export type S3BodyInput = z.infer<typeof s3BodyBase>;

export const deleteMultipleBodySchema = z.object({
   serverId: sid,
   bucketName: bucketNameSchema,
   objectKeys: z.array(objectKeySchema).min(1).max(1000),
});
export type DeleteMultipleInput = z.infer<typeof deleteMultipleBodySchema>;

export const copyMoveBodySchema = z.object({
   serverId: sid,
   sourceBucket: bucketNameSchema,
   sourceKey: objectKeySchema,
   targetBucket: bucketNameSchema,
   targetKey: objectKeySchema,
});
export type CopyMoveInput = z.infer<typeof copyMoveBodySchema>;

export const renameObjectBodySchema = z.object({
   serverId: sid,
   bucketName: bucketNameSchema,
   objectKey: objectKeySchema,
   newObjectKey: objectKeySchema,
});
export type RenameObjectInput = z.infer<typeof renameObjectBodySchema>;

export const multipartCreateBodySchema = s3BodyBase.extend({
   contentType: contentTypeSchema,
});
export type MultipartCreateInput = z.infer<typeof multipartCreateBodySchema>;
