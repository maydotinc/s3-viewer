import { z } from "zod";
import { MAX_BATCH_KEYS, MAX_LIST_BLOCK_SIZE } from "../constants";
import { isFolderKey } from "../utils";
import {
   bucketNameSchema,
   contentTypeSchema,
   idSchema,
   objectKeySchema,
} from "./primitives";

const MAX_PREFIX_LENGTH = 1024;
const MAX_TOKEN_LENGTH = 2048;

export const serverScope = z.object({ serverId: idSchema });
export const bucketScope = serverScope.extend({ bucketName: bucketNameSchema });
export const objectScope = bucketScope.extend({ objectKey: objectKeySchema });

export type ServerScope = z.infer<typeof serverScope>;
export type BucketScope = z.infer<typeof bucketScope>;
export type ObjectScope = z.infer<typeof objectScope>;

const continuationTokenSchema = z
   .string()
   .min(1)
   .max(MAX_TOKEN_LENGTH)
   .optional();

export const listObjectsQuerySchema = bucketScope.extend({
   prefix: z.string().max(MAX_PREFIX_LENGTH).default(""),
   continuationToken: continuationTokenSchema,
   blockSize: z.coerce.number().int().min(1).max(MAX_LIST_BLOCK_SIZE),
});
export type ListObjectsQuery = z.infer<typeof listObjectsQuerySchema>;

export const putObjectQuerySchema = objectScope.extend({
   contentType: contentTypeSchema,
});
export type PutObjectQuery = z.infer<typeof putObjectQuerySchema>;

export const objectKeysBodySchema = bucketScope.extend({
   objectKeys: z.array(objectKeySchema).min(1).max(MAX_BATCH_KEYS),
});
export type ObjectKeysInput = z.infer<typeof objectKeysBodySchema>;

export const keysQuerySchema = bucketScope.extend({
   prefix: objectKeySchema.refine(isFolderKey, "Prefix must end with /"),
   continuationToken: continuationTokenSchema,
});
export type KeysQuery = z.infer<typeof keysQuerySchema>;

export const renameObjectBodySchema = objectScope
   .extend({ newObjectKey: objectKeySchema })
   .refine(
      ({ objectKey, newObjectKey }) =>
         !isFolderKey(objectKey) && !isFolderKey(newObjectKey),
      { message: "Folders can't be renamed", path: ["objectKey"] }
   )
   .refine(({ objectKey, newObjectKey }) => objectKey !== newObjectKey, {
      message: "New name must be different from the current name",
      path: ["newObjectKey"],
   });
export type RenameObjectInput = z.infer<typeof renameObjectBodySchema>;
