import FormError from "@/components/Modals/form-error";
import { authClient, signOut } from "@/lib/auth";
import { loginPathFor } from "@/lib/auth-redirect";
import { useAccountSummary } from "@/lib/hooks/queries/user/useAccountSummary";
import { pluralize } from "@/lib/utils/format";
import {
   GENERIC_ERROR_MESSAGE,
   HOUR_MS,
   SESSION_FRESH_HOURS,
   SITE_PATHS,
   type AccountSummary,
} from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import {
   Dialog,
   DialogBody,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from "@s3-viewer/ui/components/dialog";
import { Input } from "@s3-viewer/ui/components/input";
import { Label } from "@s3-viewer/ui/components/label";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { toast } from "@s3-viewer/ui/components/toast";
import { useState } from "react";

type DeleteAccountModalProps = { onClose: () => void };

const FRESH_SESSION_MS = SESSION_FRESH_HOURS * HOUR_MS;
const SESSION_EXPIRED = "SESSION_EXPIRED";
const STALE_SESSION_MESSAGE =
   "For your security, deleting your account needs a sign-in from the last 24 hours.";
const SUCCESS_MESSAGE =
   "Your account and its data have been deleted. A confirmation email is on its way.";
const SKELETON_ROWS = 3;

const isStale = (createdAt: Date | string): boolean =>
   Date.now() - new Date(createdAt).getTime() >= FRESH_SESSION_MS;

const serverDetails = (memberCount: number, pendingInviteCount: number) => {
   const parts = [];
   if (memberCount > 0) {
      parts.push(
         `${pluralize(memberCount, "member")} ${memberCount === 1 ? "loses" : "lose"} access`
      );
   }
   if (pendingInviteCount > 0) {
      parts.push(`${pluralize(pendingInviteCount, "pending invite")} revoked`);
   }
   return parts.length > 0 ? parts.join(", ") : "No members";
};

const consequenceRows = (summary: AccountSummary) => {
   const rows = [
      { key: "account", label: "Your account and sessions are removed" },
      ...summary.ownedServers.map((server) => ({
         key: server.id,
         label: `${server.name} is deleted`,
         detail: serverDetails(server.memberCount, server.pendingInviteCount),
      })),
   ];
   if (summary.memberships > 0) {
      rows.push({
         key: "memberships",
         label: `You leave ${pluralize(summary.memberships, "server")}`,
      });
   }
   if (summary.sentInvites > 0) {
      rows.push({
         key: "sent",
         label: `${pluralize(summary.sentInvites, "invite")} you sent ${summary.sentInvites === 1 ? "is" : "are"} revoked`,
      });
   }
   if (summary.receivedInvites > 0) {
      rows.push({
         key: "received",
         label: `${pluralize(summary.receivedInvites, "invite")} waiting for you ${summary.receivedInvites === 1 ? "is" : "are"} declined`,
      });
   }
   return rows;
};

const ConsequenceList = ({ summary }: { summary: AccountSummary }) => (
   <ul className="divide-y divide-viewerborder text-sm">
      {consequenceRows(summary).map((row) => (
         <li key={row.key} className="flex h-10 items-center gap-4">
            <span className="min-w-0 flex-1 truncate text-viewerblack">
               {row.label}
            </span>
            {"detail" in row && (
               <span className="shrink-0 text-viewertext">{row.detail}</span>
            )}
         </li>
      ))}
   </ul>
);

const ConsequenceSkeleton = () => (
   <ul className="divide-y divide-viewerborder" aria-busy="true">
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
         <li key={index} className="flex h-10 items-center">
            <Skeleton className="h-4 w-2/3" />
         </li>
      ))}
   </ul>
);

const DeleteAccountModal = ({ onClose }: DeleteAccountModalProps) => {
   const { data: session } = authClient.useSession();
   const summary = useAccountSummary();
   const [typed, setTyped] = useState("");
   const [error, setError] = useState<string | null>(null);
   const [deleting, setDeleting] = useState(false);
   const [sessionExpired, setSessionExpired] = useState(false);

   const email = session?.user.email ?? "";
   const needsFreshSignIn =
      sessionExpired ||
      (session !== null &&
         session !== undefined &&
         isStale(session.session.createdAt));
   const confirmed =
      email.length > 0 && typed.trim().toLowerCase() === email.toLowerCase();

   const confirm = async () => {
      if (deleting || !confirmed) return;
      setDeleting(true);
      setError(null);
      const { error: deleteError } = await authClient.deleteUser({});
      if (deleteError) {
         if (deleteError.code === SESSION_EXPIRED) setSessionExpired(true);
         else setError(deleteError.message ?? GENERIC_ERROR_MESSAGE);
         setDeleting(false);
         return;
      }
      await signOut().catch(() => undefined);
      toast.success(SUCCESS_MESSAGE);
   };

   const signInAgain = () =>
      void signOut(loginPathFor(SITE_PATHS.settingsProfile));

   return (
      <Dialog
         open
         onOpenChange={(next) => {
            if (!next && !deleting) onClose();
         }}
      >
         <DialogContent showCloseButton={false}>
            <DialogHeader>
               <DialogTitle>Delete account</DialogTitle>
               <DialogDescription>
                  This is permanent and cannot be undone.
               </DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-4">
               {summary.data ? (
                  <ConsequenceList summary={summary.data} />
               ) : summary.error ? (
                  <FormError>{summary.error.message}</FormError>
               ) : (
                  <ConsequenceSkeleton />
               )}
               <p className="text-sm text-viewertext">
                  Your buckets and files are never touched. Audit entries for
                  actions you took are kept without your name or email.
               </p>
               {needsFreshSignIn ? (
                  <div className="rounded-lg bg-viewergray px-4 py-3 text-sm text-viewertext">
                     {STALE_SESSION_MESSAGE}
                  </div>
               ) : (
                  <div className="flex flex-col gap-2">
                     <Label htmlFor="delete-account-email">
                        Type your email to confirm
                     </Label>
                     <Input
                        id="delete-account-email"
                        type="email"
                        value={typed}
                        autoComplete="off"
                        spellCheck={false}
                        placeholder={email}
                        disabled={deleting}
                        aria-invalid={error ? true : undefined}
                        onChange={(event) => {
                           setTyped(event.target.value);
                           if (error) setError(null);
                        }}
                     />
                     <FormError>{error}</FormError>
                  </div>
               )}
            </DialogBody>
            <DialogFooter>
               <Button
                  type="button"
                  variant="outline"
                  className="flex-1 sm:flex-initial"
                  onClick={onClose}
                  disabled={deleting}
               >
                  Cancel
               </Button>
               {needsFreshSignIn ? (
                  <Button
                     type="button"
                     variant="outline"
                     className="flex-1 sm:flex-initial"
                     onClick={signInAgain}
                  >
                     Sign in again
                  </Button>
               ) : (
                  <Button
                     type="button"
                     variant="destructive"
                     className="flex-1 sm:flex-initial"
                     onClick={() => void confirm()}
                     disabled={!confirmed || !summary.data}
                     loading={deleting}
                  >
                     Delete account
                  </Button>
               )}
            </DialogFooter>
         </DialogContent>
      </Dialog>
   );
};

export default DeleteAccountModal;
