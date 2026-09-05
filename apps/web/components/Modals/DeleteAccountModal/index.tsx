import FormError from "@/components/Modals/form-error";
import { authClient, signOut } from "@/lib/auth";
import { loginPathFor } from "@/lib/auth-redirect";
import { pluralize } from "@/lib/utils/format";
import {
   GENERIC_ERROR_MESSAGE,
   HOUR_MS,
   PRODUCT_NAME,
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
import { toast } from "@s3-viewer/ui/components/toast";
import { useState } from "react";

// the summary is loaded by the danger-zone card before this opens, so the
// dialog renders at its final size on the first frame (design rule 3)
type DeleteAccountModalProps = {
   summary: AccountSummary;
   onClose: () => void;
};

const FRESH_SESSION_MS = SESSION_FRESH_HOURS * HOUR_MS;
const SESSION_EXPIRED = "SESSION_EXPIRED";
const STALE_SESSION_MESSAGE = `For your security, deleting your account needs a sign-in from the last ${SESSION_FRESH_HOURS} hours. Sign in again, then come back here to finish.`;
const SUCCESS_MESSAGE = `Your ${PRODUCT_NAME} account has been deleted. Your buckets and files were not touched. A confirmation email is on its way.`;

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
      parts.push(`${pluralize(pendingInviteCount, "invite")} revoked`);
   }
   return parts.length > 0 ? parts.join(" · ") : "Only you";
};

type Row = { key: string; label: React.ReactNode; detail?: string };

// every row names something that lives only in this app's database. a saved
// server is a stored address plus credentials, never the storage behind it,
// so the copy says "connection to" and never "<server> is deleted"
const removedRows = (summary: AccountSummary): Row[] => {
   const rows: Row[] = [
      {
         key: "account",
         label: "Your account, sessions and sign-in methods",
      },
      ...summary.ownedServers.map((server) => ({
         key: server.id,
         label: (
            <>
               Connection to <span className="font-medium">{server.name}</span>
            </>
         ),
         detail: serverDetails(server.memberCount, server.pendingInviteCount),
      })),
   ];
   if (summary.memberships > 0) {
      rows.push({
         key: "memberships",
         label: `Your access to ${pluralize(summary.memberships, "server")} shared with you`,
      });
   }
   if (summary.sentInvites > 0) {
      rows.push({
         key: "sent",
         label: `${pluralize(summary.sentInvites, "invite")} you sent`,
      });
   }
   if (summary.receivedInvites > 0) {
      rows.push({
         key: "received",
         label: `${pluralize(summary.receivedInvites, "invite")} waiting for you`,
      });
   }
   return rows;
};

const SectionLabel = ({ children }: { children: string }) => (
   <p className="text-[11px] font-medium tracking-wide text-viewerlighttext uppercase">
      {children}
   </p>
);

const RemovedList = ({ summary }: { summary: AccountSummary }) => (
   <div className="flex flex-col gap-2">
      <SectionLabel>{`Removed from ${PRODUCT_NAME}`}</SectionLabel>
      <ul className="divide-y divide-viewerborder text-sm">
         {removedRows(summary).map((row) => (
            <li key={row.key} className="flex h-10 items-center gap-4">
               <span className="min-w-0 flex-1 truncate text-viewerblack">
                  {row.label}
               </span>
               {row.detail && (
                  <span className="shrink-0 text-viewertext">{row.detail}</span>
               )}
            </li>
         ))}
      </ul>
      <p className="text-xs text-viewertext">
         Audit entries for actions you took are kept without your name or email.
      </p>
   </div>
);

const UntouchedCallout = () => (
   <div className="flex flex-col gap-2">
      <SectionLabel>Never touched</SectionLabel>
      <div className="rounded-lg bg-viewergray px-4 py-3 text-sm text-viewertext">
         <p className="font-medium text-viewerblack">
            Your buckets, files and S3 servers stay exactly as they are.
         </p>
         <p>
            {PRODUCT_NAME} only stores the address and keys it uses to reach
            your storage. Deleting your account throws those away and never
            reads, changes or deletes anything on your S3 servers.
         </p>
      </div>
   </div>
);

const DeleteAccountModal = ({ summary, onClose }: DeleteAccountModalProps) => {
   const { data: session } = authClient.useSession();
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
         <DialogContent className="max-w-lg" showCloseButton={!deleting}>
            <DialogHeader>
               <DialogTitle>Delete your {PRODUCT_NAME} account</DialogTitle>
               <DialogDescription>
                  Permanently removes what {PRODUCT_NAME} stores about you.
                  Nothing in your S3 storage is affected.
               </DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-6">
               <UntouchedCallout />
               <RemovedList summary={summary} />
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
               {needsFreshSignIn ? (
                  <Button type="button" onClick={signInAgain}>
                     Sign in again to continue
                  </Button>
               ) : (
                  <Button
                     type="button"
                     variant="destructive"
                     onClick={() => void confirm()}
                     disabled={!confirmed}
                     loading={deleting}
                  >
                     Delete {PRODUCT_NAME} account
                  </Button>
               )}
            </DialogFooter>
         </DialogContent>
      </Dialog>
   );
};

export default DeleteAccountModal;
