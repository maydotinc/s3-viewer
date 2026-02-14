import { z } from "zod";
import {
   bucketNameSchema,
   encryptedCredentialsSchema,
   idSchema,
   serverNameSchema,
} from "./primitives";

export const establishSchema = z.object({
   encryptedCredentials: encryptedCredentialsSchema,
});
export type EstablishInput = z.infer<typeof establishSchema>;

export const validateBucketsSchema = z.object({
   encryptedCredentials: encryptedCredentialsSchema,
   bucketNames: z.array(bucketNameSchema).min(1),
});
export type ValidateBucketsInput = z.infer<typeof validateBucketsSchema>;

export const createServerSchema = z.object({
   encryptedCredentials: encryptedCredentialsSchema,
   serverName: serverNameSchema,
   bucketNames: z.array(bucketNameSchema).optional(),
});
export type CreateServerInput = z.infer<typeof createServerSchema>;

export const serverIdBodySchema = z.object({
   serverId: idSchema,
});
export type ServerIdInput = z.infer<typeof serverIdBodySchema>;

export const renameServerSchema = z.object({
   serverId: idSchema,
   serverName: serverNameSchema,
});
export type RenameServerInput = z.infer<typeof renameServerSchema>;
