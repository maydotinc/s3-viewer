import { z } from "zod";
import { MAX_INVITE_EMAILS } from "../constants";
import {
   bucketAccessEntrySchema,
   emailSchema,
   grantableRoleSchema,
   idSchema,
} from "./primitives";
import { serverScope } from "./s3";

export const inviteIdSchema = z.object({ inviteId: idSchema });
export type InviteIdInput = z.infer<typeof inviteIdSchema>;

export const revokeInviteSchema = serverScope.merge(inviteIdSchema);
export type RevokeInviteInput = z.infer<typeof revokeInviteSchema>;

export const sendInviteSchema = z.object({
   serverId: idSchema,
   emails: z
      .array(emailSchema)
      .min(1)
      .max(MAX_INVITE_EMAILS)
      .transform((v) => [...new Set(v)]),
   role: grantableRoleSchema,
   bucketAccess: z.array(bucketAccessEntrySchema).min(1),
});
export type SendInviteInput = z.infer<typeof sendInviteSchema>;

export const updateRoleSchema = z.object({
   serverId: idSchema,
   userId: idSchema,
   role: grantableRoleSchema,
   bucketAccess: z.array(bucketAccessEntrySchema).optional(),
});
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

export const removeMemberSchema = z.object({
   serverId: idSchema,
   userId: idSchema,
});
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;
