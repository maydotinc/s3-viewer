import PasswordInput from "@/components/Auth/password-input";
import Callout from "@/components/callout";
import CenteredSpinner from "@/components/centered-spinner";
import Field from "@/components/form-field";
import FormError from "@/components/Modals/form-error";
import { ModalShell } from "@/components/Modals/modal-shell";
import { signInAgain } from "@/components/stale-sign-in";
import { authClient, deleteAccount, signOut } from "@/lib/auth";
import { useHasPassword } from "@/lib/hooks/queries/user/useHasPassword";
import { AuthErrorCode, SHARED_SERVERS_CODE } from "@s3-viewer/auth/client";
import { pluralize } from "@/lib/utils/format";
import {
   ErrorCode,
   PRODUCT_NAME,
   SITE_PATHS,
   type AccountSummary,
} from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Checkbox } from "@s3-viewer/ui/components/checkbox";
import { DialogBody, DialogFooter } from "@s3-viewer/ui/components/dialog";
import { Input } from "@s3-viewer/ui/components/input";
import { Label } from "@s3-viewer/ui/components/label";
import { toast } from "@s3-viewer/ui/components/toast";
import Link from "next/link";
import { useEffect, useState } from "react";

type DeleteAccountModalProps = {
   summary: AccountSummary;
   onClose: () => void;
};

const SUCCESS_MESSAGE = `Your ${PRODUCT_NAME} account has been deleted. Your buckets and files were not touched. A confirmation email is on its way.`;

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

const sharedServerNames = (summary: AccountSummary): string[] =>
   summary.ownedServers
      .filter((server) => server.memberCount > 0)
      .map((server) => server.name);

type SharedServersNoticeProps = {
   names: readonly string[];
   checked: boolean;
   disabled: boolean;
   onCheckedChange: (checked: boolean) => void;
};

const SharedServersNotice = ({
   names,
   checked,
   disabled,
   onCheckedChange,
}: SharedServersNoticeProps) => (
   <div className="flex flex-col gap-3 rounded-lg bg-viewerbgred/60 px-4 py-3 text-sm">
      <p className="text-viewerblack [overflow-wrap:anywhere]">
         {names.length > 0 ? (
            <>
               <span className="font-medium">{names.join(", ")}</span>{" "}
               {names.length === 1 ? "has" : "have"} other members. Deleting
               your account deletes{" "}
               {names.length === 1 ? "this server" : "these servers"} for
               everyone, and they lose access right away.
            </>
         ) : (
            "Servers you own have other members. Deleting your account deletes them for everyone, and they lose access right away."
         )}
      </p>
      <div className="flex items-start gap-2">
         <Checkbox
            id="delete-account-shared-servers"
            checked={checked}
            disabled={disabled}
            className="mt-0.5"
            onCheckedChange={(next) => onCheckedChange(next === true)}
         />
         <Label
            htmlFor="delete-account-shared-servers"
            className="font-normal text-viewerblack"
         >
            I understand other members lose these servers too
         </Label>
      </div>
   </div>
);

const NeedsPassword = () => (
   <Callout role="note">
      <p className="font-medium text-viewerblack">Set a password first</p>
      <p>
         Deleting your account needs your password, and this account signs in
         with GitHub only.
      </p>
      <Button asChild variant="outline" size="sm">
         <Link href={SITE_PATHS.settingsProfile}>Go to password settings</Link>
      </Button>
   </Callout>
);

const RemovedList = ({ summary }: { summary: AccountSummary }) => (
   <div className="flex flex-col gap-1">
      <h3 className="text-sm font-medium text-viewerblack">
         Removed from {PRODUCT_NAME}
      </h3>
      <ul className="divide-y divide-viewerborder text-sm">
         {removedRows(summary).map((row) => (
            <li
               key={row.key}
               className="flex min-h-9 flex-col justify-center gap-0.5 py-1.5 sm:flex-row sm:items-center sm:gap-4"
            >
               <span className="min-w-0 flex-1 text-viewerblack [overflow-wrap:anywhere]">
                  {row.label}
               </span>
               {row.detail && (
                  <span className="min-w-0 break-words text-viewertext sm:shrink-0">
                     {row.detail}
                  </span>
               )}
            </li>
         ))}
      </ul>
      <p className="text-xs text-viewertext">
         Audit log entries on servers shared with you keep your email, so their
         history stays complete.
      </p>
   </div>
);

const DeleteAccountModal = ({ summary, onClose }: DeleteAccountModalProps) => {
   const { data: session, isPending, isRefetching } = authClient.useSession();
   const { data: hasPassword, isPending: passwordPending } = useHasPassword();
   const [confirmedSummary] = useState(summary);
   const [typed, setTyped] = useState("");
   const [password, setPassword] = useState("");
   const [error, setError] = useState<string | null>(null);
   const [deleting, setDeleting] = useState(false);
   const [sessionExpired, setSessionExpired] = useState(false);
   const sharedNames = sharedServerNames(confirmedSummary);
   const [mustAcknowledge, setMustAcknowledge] = useState(
      sharedNames.length > 0
   );
   const [acknowledged, setAcknowledged] = useState(false);

   const { id: expectedUserId, email } = confirmedSummary.user;
   const sessionMatches =
      session?.user.id === expectedUserId &&
      session.user.email.toLowerCase() === email.toLowerCase();
   useEffect(() => {
      if (!isPending && !isRefetching && !sessionMatches && !deleting)
         onClose();
   }, [isPending, isRefetching, sessionMatches, deleting, onClose]);
   const needsPassword = hasPassword === false;
   const confirmed =
      !isPending &&
      !isRefetching &&
      sessionMatches &&
      !sessionExpired &&
      !needsPassword &&
      password.length > 0 &&
      (!mustAcknowledge || acknowledged) &&
      email.length > 0 &&
      typed.trim().toLowerCase() === email.toLowerCase();

   const confirm = async () => {
      if (deleting || !confirmed) return;
      setDeleting(true);
      setError(null);
      const result = await deleteAccount({
         expectedUserId,
         confirmedEmail: typed.trim(),
         password,
         ...(mustAcknowledge && { acknowledgeSharedServers: acknowledged }),
      });
      if (result.error) {
         if (result.code === AuthErrorCode.SESSION_EXPIRED) {
            setSessionExpired(true);
            setError(result.error);
         } else if (result.code === SHARED_SERVERS_CODE) {
            // someone joined after this dialog opened; ask before deleting their server.
            setMustAcknowledge(true);
            setAcknowledged(false);
            setError(result.error);
         } else if (
            result.code === AuthErrorCode.PASSWORD_NOT_SET ||
            result.code === ErrorCode.ACCOUNT_CHANGED
         ) {
            toast.error(result.error);
            onClose();
         } else setError(result.error);
         setDeleting(false);
         return;
      }
      await signOut().catch(() => undefined);
      toast.success(SUCCESS_MESSAGE);
   };

   const clearError = () => {
      if (error) setError(null);
   };

   return (
      <ModalShell
         closable={!deleting}
         showCloseButton={false}
         onClose={onClose}
         title={`Delete your ${PRODUCT_NAME} account`}
         description={`Permanently removes what ${PRODUCT_NAME} stores about you. Your buckets, files and S3 servers are never touched.`}
         className="max-w-lg"
      >
         <DialogBody className="flex flex-col gap-5">
            <RemovedList summary={confirmedSummary} />
            <Callout>
               {PRODUCT_NAME} only stores the address and keys it uses to reach
               your storage. Deleting your account throws those away and never
               reads, changes or deletes anything on your S3 servers.
            </Callout>
            {passwordPending ? (
               <CenteredSpinner
                  label="Loading account confirmation"
                  className="h-24"
               />
            ) : needsPassword ? (
               <NeedsPassword />
            ) : (
               <div className="flex flex-col gap-4">
                  {mustAcknowledge && (
                     <SharedServersNotice
                        names={sharedNames}
                        checked={acknowledged}
                        disabled={deleting}
                        onCheckedChange={(next) => {
                           setAcknowledged(next);
                           clearError();
                        }}
                     />
                  )}
                  <Field
                     label="Type your email to confirm"
                     htmlFor="delete-account-email"
                     className="gap-2"
                  >
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
                           clearError();
                        }}
                     />
                  </Field>
                  <Field
                     label="Your password"
                     htmlFor="delete-account-password"
                     className="gap-2"
                  >
                     <PasswordInput
                        id="delete-account-password"
                        autoComplete="current-password"
                        value={password}
                        disabled={deleting}
                        aria-invalid={error ? true : undefined}
                        onChange={(event) => {
                           setPassword(event.target.value);
                           clearError();
                        }}
                     />
                     <FormError>{error}</FormError>
                     {sessionExpired && (
                        <Button
                           type="button"
                           variant="link"
                           size="sm"
                           className="h-auto self-start px-0"
                           onClick={signInAgain}
                        >
                           Sign in again
                        </Button>
                     )}
                  </Field>
               </div>
            )}
         </DialogBody>
         <DialogFooter>
            <Button
               type="button"
               variant="outline"
               className="flex-1 sm:flex-initial"
               disabled={deleting}
               onClick={onClose}
            >
               Cancel
            </Button>
            <Button
               type="button"
               variant="destructive"
               className="flex-1 sm:flex-initial"
               onClick={() => void confirm()}
               disabled={!confirmed}
               loading={deleting}
            >
               Delete account
            </Button>
         </DialogFooter>
      </ModalShell>
   );
};

export default DeleteAccountModal;
