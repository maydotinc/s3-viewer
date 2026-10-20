import { z } from "zod";
import { AuditLevel, type AuditManageRole } from "../audit-types";
import { MAX_VALIDATE_BUCKETS } from "../constants";
import { Role } from "../server-types";
import { pageSchema } from "./pagination";
import {
   bucketNameListSchema,
   encryptedCredentialsSchema,
   existingBucketNameSchema,
   isDatabaseDate,
   isDatabaseText,
   roleSchema,
   serverNameSchema,
} from "./primitives";
import { serverScope } from "./s3";

export const serverListQuerySchema = z.object({
   cursor: z.string().min(1).max(512).optional(),
});

export const serverCredentialsSchema = z.object({
   endpoint: z.string().min(1),
   region: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "Invalid region"),
   accessKey: z.string().min(1),
   secretKey: z.string().min(1),
   sessionToken: z.string().min(1).optional(),
});
export type ServerCredentials = z.infer<typeof serverCredentialsSchema>;

export const establishSchema = z.object({
   encryptedCredentials: encryptedCredentialsSchema,
});
export type EstablishInput = z.infer<typeof establishSchema>;

export const validateBucketsSchema = z.object({
   encryptedCredentials: encryptedCredentialsSchema,
   bucketNames: bucketNameListSchema
      .refine((v) => v.length > 0, "Check at least one bucket")
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

const MAX_AUDIT_RETENTION_DAYS = 3650;

export const auditSettingsSchema = serverScope.extend({
   enabled: z.boolean(),
   viewRole: roleSchema.optional(),
   manageRole: roleSchema
      .refine(
         (role): role is AuditManageRole =>
            role === Role.OWNER || role === Role.ADMIN,
         "Only owners and admins can manage the audit log"
      )
      .optional(),
   retentionDays: z
      .number()
      .int()
      .min(0)
      .max(MAX_AUDIT_RETENTION_DAYS)
      .optional(),
   level: z.nativeEnum(AuditLevel).optional(),
});
export type AuditSettingsInput = z.infer<typeof auditSettingsSchema>;

const auditDateSchema = z.coerce.date().refine(isDatabaseDate, "Invalid date");

export const auditQuerySchema = serverScope.merge(pageSchema).extend({
   action: z
      .string()
      .regex(/^[a-z_.]+$/)
      .max(40)
      .optional(),
   actor: z
      .string()
      .min(1)
      .max(64)
      .refine(isDatabaseText, "Invalid text")
      .optional(),
   bucket: existingBucketNameSchema.optional(),
   q: z
      .string()
      .min(3)
      .max(256)
      .refine(isDatabaseText, "Invalid text")
      .optional(),
   from: auditDateSchema.optional(),
   to: auditDateSchema.optional(),
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;
