import { z } from "zod";
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
   bucketNames: bucketNameListSchema.refine((v) => v.length > 0),
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
