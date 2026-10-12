import PasswordInput from "@/components/Auth/password-input";
import Callout from "@/components/callout";
import CenteredSpinner from "@/components/centered-spinner";
import Field from "@/components/form-field";
import FormError from "@/components/Modals/form-error";
import { ModalShell } from "@/components/Modals/modal-shell";
import SectionLabel from "@/components/section-label";
import StaleSignIn, { signInAgain } from "@/components/stale-sign-in";
import StatusMessage from "@/components/status-message";
import { authClient, deleteAccount, signOut } from "@/lib/auth";
import { useHasPassword } from "@/lib/hooks/queries/user/useHasPassword";
import { AuthErrorCode, SHARED_SERVERS_CODE } from "@s3-viewer/auth/client";
import { pluralize } from "@/lib/utils/format";
import {
   ErrorCode,
   isSessionFresh,
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
import { KeyRound } from "lucide-react";
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
   <StatusMessage
      icon={KeyRound}
      title="Set a password first"
      className="py-4"
      actions={
         <Button asChild variant="outline" size="sm">
            <Link href={SITE_PATHS.settingsProfile}>
               Go to password settings
            </Link>
         </Button>
      }
   >
      Deleting your account needs your password, and this account signs in with
      GitHub only.
   </StatusMessage>
);

const RemovedList = ({ summary }: { summary: AccountSummary }) => (
   <div className="flex flex-col gap-2">
      <SectionLabel>{`Removed from ${PRODUCT_NAME}`}</SectionLabel>
      <ul className="divide-y divide-viewerborder text-sm">
         {removedRows(summary).map((row) => (
            <li
               key={row.key}
               className="flex min-h-10 flex-col justify-center gap-1 py-2 sm:flex-row sm:items-center sm:gap-4"
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

const UntouchedCallout = () => (
   <div className="flex flex-col gap-2">
      <SectionLabel>Never touched</SectionLabel>
      <Callout className="gap-0">
         <p className="font-medium text-viewerblack">
            Your buckets, files and S3 servers stay exactly as they are.
         </p>
         <p>
            {PRODUCT_NAME} only stores the address and keys it uses to reach
            your storage. Deleting your account throws those away and never
            reads, changes or deletes anything on your S3 servers.
         </p>
      </Callout>
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
   const needsFreshSignIn =
      sessionExpired ||
      (session !== null &&
         session !== undefined &&
         !isSessionFresh(session.session.createdAt));
   const needsPassword = hasPassword === false;
   const confirmed =
      !isPending &&
      !isRefetching &&
      sessionMatches &&
      !needsFreshSignIn &&
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
         if (result.code === AuthErrorCode.SESSION_EXPIRED)
            setSessionExpired(true);
         else if (result.code === SHARED_SERVERS_CODE) {
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

   return (
      <ModalShell
         closable={!deleting}
         onClose={onClose}
         title={`Delete your ${PRODUCT_NAME} account`}
         description={`Permanently removes what ${PRODUCT_NAME} stores about you. Nothing in your S3 storage is affected.`}
         height="xl"
         className="max-w-lg"
      >
         <DialogBody className="flex min-h-0 flex-1 flex-col gap-6 [&>*]:shrink-0">
            <UntouchedCallout />
            <RemovedList summary={confirmedSummary} />
            <div className="flex h-56 flex-col overflow-y-auto">
               {needsFreshSignIn ? (
                  <StaleSignIn
                     title="This needs a recent sign-in"
                     action="deleting your account"
                     className="py-4"
                  />
               ) : passwordPending ? (
                  <CenteredSpinner
                     label="Loading account confirmation"
                     className="h-full"
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
                              if (error) setError(null);
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
                              if (error) setError(null);
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
                              if (error) setError(null);
                           }}
                        />
                        <FormError>{error}</FormError>
                     </Field>
                  </div>
               )}
            </div>
         </DialogBody>
         <DialogFooter className="min-h-16">
            {needsFreshSignIn ? (
               <Button type="button" onClick={signInAgain}>
                  Sign in again to continue
               </Button>
            ) : needsPassword ? null : (
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
      </ModalShell>
   );
};

export default DeleteAccountModal;
