import { MAX_PENDING_INVITES } from "@s3-viewer/types";

const exceedsPendingInviteCap = (
   existingTotal: number,
   newInvites: number
): boolean =>
   newInvites > 0 && existingTotal + newInvites > MAX_PENDING_INVITES;

export { exceedsPendingInviteCap };
