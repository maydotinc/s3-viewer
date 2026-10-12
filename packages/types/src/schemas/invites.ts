import { z } from "zod";
import { MAX_INVITE_EMAILS } from "../constants";
import {
   MAX_BUCKET_NAMES,
   bucketAccessEntrySchema,
   emailSchema,
   grantableRoleSchema,
   idSchema,
} from "./primitives";
import { Role, type GrantableRole } from "../server-types";
import { serverScope } from "./s3";

export const inviteIdSchema = z.object({ inviteId: idSchema });
export type InviteIdInput = z.infer<typeof inviteIdSchema>;

export const revokeInviteSchema = serverScope.merge(inviteIdSchema);
export type RevokeInviteInput = z.infer<typeof revokeInviteSchema>;

const adminsHoldWholeBuckets = ({
   role,
   bucketAccess,
}: {
   role: GrantableRole;
   bucketAccess?: { folders: string[] | null }[] | undefined;
}): boolean =>
   role !== Role.ADMIN ||
   (bucketAccess ?? []).every(({ folders }) => folders === null);

const ADMIN_FOLDERS = {
   message: "Admins can't be limited to folders",
   path: ["bucketAccess"],
};

export const sendInviteSchema = z
   .object({
      serverId: idSchema,
      emails: z
         .array(emailSchema)
         .min(1)
         .max(MAX_INVITE_EMAILS)
         .transform((v) => [...new Set(v)]),
      role: grantableRoleSchema,
      bucketAccess: z
         .array(bucketAccessEntrySchema)
         .min(1)
         .max(MAX_BUCKET_NAMES),
   })
   .refine(adminsHoldWholeBuckets, ADMIN_FOLDERS);
export type SendInviteInput = z.infer<typeof sendInviteSchema>;

const bucketAccessListSchema = z
   .array(bucketAccessEntrySchema)
   .max(MAX_BUCKET_NAMES);

export const updateRoleSchema = z
   .object({
      serverId: idSchema,
      userId: idSchema,
      role: grantableRoleSchema,
      bucketAccess: bucketAccessListSchema.optional(),
      previousBucketAccess: bucketAccessListSchema.optional(),
   })
   .refine(adminsHoldWholeBuckets, ADMIN_FOLDERS)
   .refine(
      ({ bucketAccess, previousBucketAccess }) =>
         bucketAccess === undefined || previousBucketAccess !== undefined,
      {
         message: "Refresh the page and try again",
         path: ["previousBucketAccess"],
      }
   );
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

export const removeMemberSchema = z.object({
   serverId: idSchema,
   userId: idSchema,
});
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;
