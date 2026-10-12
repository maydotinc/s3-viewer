import CenteredSpinner from "@/components/centered-spinner";
import Field from "@/components/form-field";
import { FormDialog } from "@/components/Modals/form-dialog";
import FormError from "@/components/Modals/form-error";
import NoEmailNotice from "@/components/no-email-notice";
import RemovableChip from "@/components/removable-chip";
import Reserve from "@/components/reserve";
import UnverifiedCallout from "@/components/Settings/unverified-callout";
import { ApiError } from "@/lib/api";
import useSendInvite from "@/lib/hooks/mutations/invites/useSendInvite";
import useInstanceConfig, {
   emailState,
} from "@/lib/hooks/queries/useInstanceConfig";
import { splitList } from "@/lib/utils/split-list";
import { assignableRoles } from "@s3-viewer/permissions";
import {
   ErrorCode,
   INVITE_TTL_DAYS,
   MAX_INVITE_EMAILS,
   Role,
   emailSchema,
   type GrantableRole,
   type S3Bucket,
   type SentInvite,
} from "@s3-viewer/types";
import { Input } from "@s3-viewer/ui/components/input";
import { toast } from "@s3-viewer/ui/components/toast";
import { useId, useState, type FormEvent } from "react";
import BucketAccessPicker from "./bucket-access-picker";
import {
   TOO_MANY_BUCKETS,
   accessErrors,
   accessSummaryError,
   commitDrafts,
   grantPayload,
   tooManyBuckets,
   type GrantRow,
} from "./bucket-grants";
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

const warnUnemailed = (invites: SentInvite[]) => {
   const unemailed = invites.filter(({ emailed }) => emailed === false);
   const [first] = unemailed;
   if (!first) return;
   const one = unemailed.length === 1;
   toast.warning(
      one
         ? `Invite saved, but no email went to ${first.email}`
         : `${unemailed.length} invites saved, but their emails weren't sent`,
      {
         description: `Ask them to sign in with ${one ? "that address" : "those addresses"} and open Settings, Invites.`,
      }
   );
};

const InviteDialog = ({
   serverId,
   myRole,
   buckets,
   isBucketsLoading,
   onClose,
}: InviteDialogProps) => {
   const emailsId = useId();
   const roleId = useId();
   const roles = assignableRoles(myRole);
   const [emails, setEmails] = useState("");
   const [role, setRole] = useState<GrantableRole>(
      lowestRole(roles) ?? Role.VIEWER
   );
   const [access, setAccess] = useState<GrantRow[]>([]);
   const [submitted, setSubmitted] = useState(false);
   const [emailError, setEmailError] = useState<string | null>(null);
   const sendInvite = useSendInvite();
   const transport = emailState(useInstanceConfig());
   const noEmail = transport === "disabled";

   const list = splitEmails(emails);
   const tooMany = list.length > MAX_INVITE_EMAILS;
   const unverified =
      sendInvite.error instanceof ApiError &&
      sendInvite.error.code === ErrorCode.EMAIL_UNVERIFIED;
   const emailErrorId = `${emailsId}-error`;
   const check = { buckets, myRole, serverRole: role };
   const [invalidAccess] = accessErrors(access, { ...check, drafts: true });
   const overLimit = tooManyBuckets(access);
   const accessError =
      access.length === 0
         ? "Select at least one bucket"
         : invalidAccess
           ? accessSummaryError(invalidAccess)
           : overLimit
             ? TOO_MANY_BUCKETS
             : null;

   const removeEmail = (address: string) => {
      setEmails(list.filter((entry) => entry !== address).join(", "));
      setEmailError(null);
   };

   const submit = (e: FormEvent) => {
      e.preventDefault();
      setSubmitted(true);
      const committed = commitDrafts(access, check);
      setAccess(committed);
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
      const [refused] = accessErrors(committed, { ...check, drafts: true });
      if (committed.length === 0 || refused || tooManyBuckets(committed))
         return;
      sendInvite.mutate(
         {
            serverId,
            emails: list.map((v) => emailSchema.parse(v)),
            role,
            bucketAccess: grantPayload(committed),
         },
         {
            onSuccess: ({ invites }) => {
               warnUnemailed(invites);
               onClose();
            },
         }
      );
   };

   return (
      <FormDialog
         onClose={onClose}
         isPending={sendInvite.isPending}
         title="Invite people"
         description={`Invites expire after ${INVITE_TTL_DAYS} days and members only see the buckets you grant.`}
         height="xl"
         contentClassName="max-w-lg"
         bodyClassName="relative"
         formAutoComplete="off"
         onSubmit={submit}
         submitLabel={
            list.length > 1 ? `Send ${list.length} invites` : "Send invite"
         }
         submitDisabled={
            transport !== "enabled" || tooMany || overLimit || list.length === 0
         }
      >
         {transport === "loading" && (
            <CenteredSpinner
               label="Loading invite options"
               className="absolute inset-0"
            />
         )}
         <Reserve
            show={transport !== "loading"}
            as="div"
            className="flex flex-col gap-4 [&>*]:shrink-0"
         >
            {noEmail && (
               <NoEmailNotice>
                  Ask whoever runs it to set up email.
               </NoEmailNotice>
            )}
            <Field label="Email addresses" htmlFor={emailsId} className="gap-2">
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
               <ul className="flex min-h-[22px] min-w-0 flex-wrap gap-1.5">
                  {list.map((address) => (
                     <RemovableChip
                        key={address}
                        label={address}
                        invalid={!emailSchema.safeParse(address).success}
                        disabled={sendInvite.isPending}
                        onRemove={() => removeEmail(address)}
                     />
                  ))}
               </ul>
               <FormError id={emailErrorId}>
                  {tooMany
                     ? `You can invite up to ${MAX_INVITE_EMAILS} people at a time`
                     : emailError}
               </FormError>
            </Field>
            <Field label="Server role" htmlFor={roleId} className="gap-2">
               <RoleSelect
                  id={roleId}
                  label="Server role"
                  value={role}
                  roles={roles}
                  disabled={sendInvite.isPending}
                  onChange={setRole}
               />
            </Field>
            <BucketAccessPicker
               serverId={serverId}
               heading="Bucket access"
               label="Bucket access for invited people"
               myRole={myRole}
               buckets={buckets}
               isLoading={isBucketsLoading}
               value={access}
               onChange={setAccess}
               serverRole={role}
               reserveErrorSpace
               showErrors={submitted}
               error={
                  submitted ? accessError : overLimit ? TOO_MANY_BUCKETS : null
               }
               disabled={sendInvite.isPending}
            />
            {!noEmail && unverified && (
               <UnverifiedCallout action="send invites" />
            )}
         </Reserve>
      </FormDialog>
   );
};

export default InviteDialog;
