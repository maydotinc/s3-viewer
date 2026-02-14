import { z } from "zod";
import { bucketAccessEntrySchema, idSchema, roleSchema } from "./primitives";

export const inviteIdBodySchema = z.object({
   inviteId: z.string().min(1),
});
export type InviteIdInput = z.infer<typeof inviteIdBodySchema>;

export const sendInviteSchema = z.object({
   serverId: idSchema,
   emails: z.array(z.string().email()).min(1).max(5),
   role: roleSchema,
   expiresAt: z.string().optional(),
   bucketAccess: z.array(bucketAccessEntrySchema).min(1),
});
export type SendInviteInput = z.infer<typeof sendInviteSchema>;

export const updateRoleSchema = z.object({
   serverId: idSchema,
   userId: z.string().min(1),
   role: roleSchema,
   bucketAccess: z.array(bucketAccessEntrySchema).optional(),
});
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

export const deleteRoleSchema = z.object({
   serverId: idSchema,
   userId: z.string().min(1),
   role: roleSchema,
});
export type DeleteRoleInput = z.infer<typeof deleteRoleSchema>;
