import { z } from "zod";
import { MAX_INVITE_EMAILS, MAX_INVITE_SERVERS } from "../constants";
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

// one server's share of an invite: the server role plus the buckets (and folders) it opens.
export const inviteTargetSchema = z
   .object({
      serverId: idSchema,
      role: grantableRoleSchema,
      bucketAccess: z
         .array(bucketAccessEntrySchema)
         .min(1)
         .max(MAX_BUCKET_NAMES),
   })
   .refine(adminsHoldWholeBuckets, ADMIN_FOLDERS);
export type InviteTarget = z.infer<typeof inviteTargetSchema>;

export const sendInvitesSchema = z.object({
   emails: z
      .array(emailSchema)
      .min(1)
      .max(MAX_INVITE_EMAILS)
      .transform((v) => [...new Set(v)]),
   targets: z
      .array(inviteTargetSchema)
      .min(1)
      .max(MAX_INVITE_SERVERS)
      .refine(
         (targets) =>
            new Set(targets.map(({ serverId }) => serverId)).size ===
            targets.length,
         { message: "Each server can only be listed once" }
      ),
   // false saves the invites without emailing anyone; they still appear under Settings, Invites.
   notify: z.boolean().default(true),
});
export type SendInvitesInput = z.infer<typeof sendInvitesSchema>;

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
