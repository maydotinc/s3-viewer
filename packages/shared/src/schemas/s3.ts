import { z } from "zod";
import {
   MAX_BATCH_KEYS,
   MAX_LIST_BLOCK_SIZE,
   MAX_MOVE_KEYS,
} from "../constants";
import { isFolderKey } from "../utils";
import {
   bucketNameSchema,
   contentTypeSchema,
   expectedUserShape,
   idSchema,
   existingBucketNameSchema,
   existingObjectKeySchema,
   existingPrefixSchema,
   fileKeySchema,
   objectKeySchema,
} from "./primitives";

const MAX_TOKEN_LENGTH = 2048;

const uniqueBy = <T>(items: T[], pick: (item: T) => string): boolean =>
   new Set(items.map(pick)).size === items.length;

type Refinement<T, M> = [check: (value: T) => boolean, message: M];

export const uniqueKeys = <T>(
   pick: (item: T) => string,
   label: string
): Refinement<T[], string> => [
   (items) => uniqueBy(items, pick),
   `${label} must be unique`,
];

export const notFolder = (
   message: string
): Refinement<{ objectKey: string }, { message: string; path: string[] }> => [
   ({ objectKey }) => !isFolderKey(objectKey),
   { message, path: ["objectKey"] },
];

export const serverScope = z.object({ serverId: idSchema });
export const bucketScope = serverScope.extend({
   bucketName: existingBucketNameSchema,
});
export const newBucketScope = serverScope.extend({
   bucketName: bucketNameSchema,
});
export const objectScope = bucketScope.extend({
   objectKey: existingObjectKeySchema,
});

export type ServerScope = z.infer<typeof serverScope>;

const continuationTokenSchema = z
   .string()
   .min(1)
   .max(MAX_TOKEN_LENGTH)
   .optional();

export const listObjectsQuerySchema = bucketScope.extend({
   prefix: existingPrefixSchema.default(""),
   continuationToken: continuationTokenSchema,
   blockSize: z.coerce.number().int().min(1).max(MAX_LIST_BLOCK_SIZE),
});

export const observedETagSchema = z
   .string()
   .max(256)
   .regex(/^"[\x21\x23-\x7e]+"$/)
   .refine((value) => value !== '"*"', "Wildcard ETags are not allowed");

export const putObjectQuerySchema = objectScope.extend({
   objectKey: fileKeySchema,
   ...expectedUserShape,
   contentType: contentTypeSchema,
   expectedETag: observedETagSchema.optional(),
});

export const objectKeysBodySchema = bucketScope.extend({
   objectKeys: z.array(existingObjectKeySchema).min(1).max(MAX_BATCH_KEYS),
});

export const deleteObjectsBodySchema = bucketScope.extend({
   ...expectedUserShape,
   objects: z
      .array(
         z.object({
            key: existingObjectKeySchema,
            expectedETag: observedETagSchema.nullable(),
         })
      )
      .min(1)
      .max(MAX_BATCH_KEYS)
      .refine(...uniqueKeys(({ key }: { key: string }) => key, "Object keys")),
});
export type DeleteObjectsInput = z.infer<typeof deleteObjectsBodySchema>;

export const keysQuerySchema = bucketScope.extend({
   prefix: existingObjectKeySchema.refine(
      isFolderKey,
      "Prefix must end with /"
   ),
   continuationToken: continuationTokenSchema,
});

const objectPairShape = {
   newObjectKey: objectKeySchema,
   ...expectedUserShape,
   expectedETag: observedETagSchema,
};

type ObjectPair = { objectKey: string; newObjectKey: string };

const bothObjects = ({ objectKey, newObjectKey }: ObjectPair): boolean =>
   !isFolderKey(objectKey) && !isFolderKey(newObjectKey);

const keysDiffer = ({ objectKey, newObjectKey }: ObjectPair): boolean =>
   objectKey !== newObjectKey;

const DIFFERENT_KEY = "New name must be different from the current name";

export const renameObjectBodySchema = objectScope
   .extend(objectPairShape)
   .refine(bothObjects, {
      message: "Folders can't be renamed",
      path: ["objectKey"],
   })
   .refine(keysDiffer, { message: DIFFERENT_KEY, path: ["newObjectKey"] });

export const copyObjectBodySchema = objectScope
   .extend({
      ...objectPairShape,
      expectedDestinationETag: observedETagSchema.optional(),
   })
   .refine(bothObjects, {
      message: "Folders can't be copied",
      path: ["objectKey"],
   })
   .refine(keysDiffer, { message: DIFFERENT_KEY, path: ["newObjectKey"] });

export const moveObjectsBodySchema = bucketScope.extend({
   ...expectedUserShape,
   objects: z
      .array(
         z
            .object({
               key: existingObjectKeySchema,
               newKey: objectKeySchema,
               expectedETag: observedETagSchema.nullable(),
            })
            .refine(({ key, newKey }) => key !== newKey, {
               message: DIFFERENT_KEY,
               path: ["newKey"],
            })
            // a prefix move carries its slash-ending marker objects, so only a mismatch between the two is refused.
            .refine(
               ({ key, newKey }) => isFolderKey(key) === isFolderKey(newKey),
               {
                  message: "An object can't be moved onto a folder key",
                  path: ["newKey"],
               }
            )
      )
      .min(1)
      .max(MAX_MOVE_KEYS)
      .refine(...uniqueKeys(({ key }: { key: string }) => key, "Object keys"))
      .refine(
         ...uniqueKeys(
            ({ newKey }: { newKey: string }) => newKey,
            "New object keys"
         )
      ),
});

export type MoveObjectsInput = z.infer<typeof moveObjectsBodySchema>;

export const createFolderBodySchema = bucketScope.extend({
   ...expectedUserShape,
   folderKey: objectKeySchema.refine(isFolderKey, "Folders must end with /"),
});
