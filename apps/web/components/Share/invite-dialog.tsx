import { FormDialog } from "@/components/Modals/form-dialog";
import FormError from "@/components/Modals/form-error";
import UnverifiedCallout from "@/components/Settings/unverified-callout";
import { ApiError } from "@/lib/api";
import useSendInvite from "@/lib/hooks/mutations/invites/useSendInvite";
import { splitList } from "@/lib/utils/split-list";
import { assignableRoles } from "@s3-viewer/permissions";
import {
   BucketAccessEntry,
   ErrorCode,
   GrantableRole,
   INVITE_TTL_DAYS,
   MAX_INVITE_EMAILS,
   Role,
   S3Bucket,
   emailSchema,
} from "@s3-viewer/types";
import { Input } from "@s3-viewer/ui/components/input";
import { Label } from "@s3-viewer/ui/components/label";
import { X } from "lucide-react";
import { FormEvent, useId, useState } from "react";
import BucketAccessPicker from "./bucket-access-picker";
import RoleSelect from "./role-select";
import { lowestRole } from "./roles";

type InviteDialogProps = {
   serverId: string;
   myRole: Role;
   buckets: S3Bucket[];
   isBucketsLoading: boolean;
   onClose: () => void;
};

const splitEmails = (raw: string): string[] => splitList(raw, /[\s,;]+/);

const InviteDialog = ({
   serverId,
   myRole,
   buckets,
   isBucketsLoading,
   onClose,
}: InviteDialogProps) => {
   const emailsId = useId();
   const roleId = useId();
   const roles = assignableRoles(myRole) as GrantableRole[];
   const [emails, setEmails] = useState("");
   const [role, setRole] = useState<GrantableRole>(
      (lowestRole(roles) as GrantableRole | null) ?? Role.VIEWER
   );
   const [access, setAccess] = useState<BucketAccessEntry[]>([]);
   const [submitted, setSubmitted] = useState(false);
   const [emailError, setEmailError] = useState<string | null>(null);
   const sendInvite = useSendInvite();

   const list = splitEmails(emails);
   const tooMany = list.length > MAX_INVITE_EMAILS;
   const unverified =
      sendInvite.error instanceof ApiError &&
      sendInvite.error.code === ErrorCode.EMAIL_UNVERIFIED;
   const emailErrorId = `${emailsId}-error`;

   const removeEmail = (address: string) => {
      setEmails(list.filter((entry) => entry !== address).join(", "));
      setEmailError(null);
   };

   const submit = (e: FormEvent) => {
      e.preventDefault();
      setSubmitted(true);
      if (list.length === 0) {
         setEmailError("Enter at least one email address");
         return;
      }
      if (tooMany) return;
      const invalid = list.filter((v) => !emailSchema.safeParse(v).success);
      if (invalid.length > 0) {
         setEmailError(`Check these addresses: ${invalid.join(", ")}`);
         return;
      }
      setEmailError(null);
      if (access.length === 0) return;
      sendInvite.mutate(
         {
            serverId,
            emails: list.map((v) => emailSchema.parse(v)),
            role,
            bucketAccess: access as {
               bucketName: string;
               role: GrantableRole;
            }[],
         },
         { onSuccess: onClose }
      );
   };

   return (
      <FormDialog
         onClose={onClose}
         isPending={sendInvite.isPending}
         title="Invite people"
         description={`Invites expire after ${INVITE_TTL_DAYS} days and members only see the buckets you grant.`}
         contentClassName="max-w-lg"
         bodyClassName="flex flex-col gap-4"
         formAutoComplete="off"
         onSubmit={submit}
         submitLabel={
            list.length > 1 ? `Send ${list.length} invites` : "Send invite"
         }
         submitDisabled={tooMany || list.length === 0}
      >
         <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor={emailsId}>Email addresses</Label>
            <Input
               id={emailsId}
               type="text"
               inputMode="email"
               autoComplete="off"
               placeholder="name@example.com, another@example.com"
               value={emails}
               aria-invalid={emailError || tooMany ? true : undefined}
               aria-describedby={emailErrorId}
               onChange={(e) => {
                  setEmails(e.target.value);
                  setEmailError(null);
               }}
            />
            {list.length > 0 && (
               <ul className="flex min-w-0 flex-wrap gap-1.5">
                  {list.map((address) => {
                     const valid = emailSchema.safeParse(address).success;
                     return (
                        <li
                           key={address}
                           className={`flex max-w-full items-center gap-1 rounded-md py-0.5 pr-1 pl-2 text-xs ${
                              valid
                                 ? "bg-viewergray text-viewerblack"
                                 : "bg-viewerbgred text-viewertextred"
                           }`}
                        >
                           <span className="min-w-0 truncate">{address}</span>
                           <button
                              type="button"
                              aria-label={`Remove ${address}`}
                              disabled={sendInvite.isPending}
                              onClick={() => removeEmail(address)}
                              className="shrink-0 cursor-pointer rounded-sm border border-transparent p-0.5 outline-none transition-colors hover:bg-viewerborder focus-visible:border-viewerblue disabled:opacity-50"
                           >
                              <X aria-hidden="true" className="size-3" />
                           </button>
                        </li>
                     );
                  })}
               </ul>
            )}
            <FormError id={emailErrorId}>
               {tooMany
                  ? `You can invite up to ${MAX_INVITE_EMAILS} people at a time`
                  : emailError}
            </FormError>
         </div>
         <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor={roleId}>Server role</Label>
            <RoleSelect
               id={roleId}
               label="Server role"
               value={role}
               roles={roles}
               disabled={sendInvite.isPending}
               onChange={(next) => setRole(next as GrantableRole)}
            />
         </div>
         <BucketAccessPicker
            heading="Bucket access"
            label="Bucket access for invited people"
            myRole={myRole}
            buckets={buckets}
            isLoading={isBucketsLoading}
            value={access}
            onChange={setAccess}
            error={
               submitted && access.length === 0
                  ? "Select at least one bucket"
                  : null
            }
            disabled={sendInvite.isPending}
         />
         {unverified && (
            <UnverifiedCallout>
               Verify your email address before sending invites.
            </UnverifiedCallout>
         )}
      </FormDialog>
   );
};

export default InviteDialog;
