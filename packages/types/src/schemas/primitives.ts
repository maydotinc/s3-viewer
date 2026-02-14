import { z } from "zod";

export const idSchema = z.string().cuid();
export const bucketNameSchema = z.string().min(1).max(255);
export const objectKeySchema = z.string().min(1).max(1024);
export const contentTypeSchema = z.string().min(1).max(255);
export const serverNameSchema = z.string().min(1).max(255);
export const encryptedCredentialsSchema = z.string().min(1);

export const roleSchema = z.enum(["OWNER", "ADMIN", "EDITOR", "VIEWER"]);
export const bucketAccessEntrySchema = z.object({
   bucketName: bucketNameSchema,
   role: roleSchema,
});
