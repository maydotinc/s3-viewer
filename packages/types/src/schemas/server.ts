import { z } from "zod";
import { MAX_VALIDATE_BUCKETS } from "../constants";
import {
   bucketNameListSchema,
   encryptedCredentialsSchema,
   serverNameSchema,
} from "./primitives";
import { serverScope } from "./s3";

export const establishSchema = z.object({
   encryptedCredentials: encryptedCredentialsSchema,
});
export type EstablishInput = z.infer<typeof establishSchema>;

export const validateBucketsSchema = z.object({
   encryptedCredentials: encryptedCredentialsSchema,
   bucketNames: bucketNameListSchema
      .refine((v) => v.length > 0)
      .refine(
         (v) => v.length <= MAX_VALIDATE_BUCKETS,
         `Check at most ${MAX_VALIDATE_BUCKETS} buckets at a time`
      ),
});
export type ValidateBucketsInput = z.infer<typeof validateBucketsSchema>;

export const createServerSchema = z.object({
   encryptedCredentials: encryptedCredentialsSchema,
   serverName: serverNameSchema,
   bucketNames: bucketNameListSchema.optional(),
});
export type CreateServerInput = z.infer<typeof createServerSchema>;

export const renameServerSchema = serverScope.extend({
   serverName: serverNameSchema,
});
export type RenameServerInput = z.infer<typeof renameServerSchema>;

export const updateCredentialsSchema = serverScope.merge(establishSchema);
export type UpdateCredentialsInput = z.infer<typeof updateCredentialsSchema>;
