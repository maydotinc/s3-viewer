import FormError from "@/components/Modals/form-error";
import useSendInvite from "@/lib/hooks/mutations/invites/useSendInvite";
import { splitList } from "@/lib/utils/split-list";
import { assignableRoles } from "@s3-viewer/permissions";
import {
   BucketAccessEntry,
   GrantableRole,
   MAX_INVITE_EMAILS,
   Role,
   S3Bucket,
   emailSchema,
} from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Input } from "@s3-viewer/ui/components/input";
import { Label } from "@s3-viewer/ui/components/label";
import { X } from "lucide-react";
import { FormEvent, useState } from "react";
import BucketAccessPicker from "./bucket-access-picker";
import RoleSelect from "./role-select";
import { lowestRole } from "./roles";

type InviteFormProps = {
   serverId: string;
   myRole: Role;
   buckets: S3Bucket[];
   isBucketsLoading: boolean;
};

const splitEmails = (raw: string): string[] => splitList(raw, /[\s,;]+/);

const InviteForm = ({
   serverId,
   myRole,
   buckets,
   isBucketsLoading,
}: InviteFormProps) => {
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
         {
            onSuccess: () => {
               setEmails("");
               setAccess([]);
               setSubmitted(false);
            },
         }
      );
   };

   return (
      <form onSubmit={submit} className="flex min-w-0 flex-col gap-5">
         <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="invite-emails">Email addresses</Label>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
               <Input
                  id="invite-emails"
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  placeholder="name@example.com, another@example.com"
                  className="min-w-0 flex-1"
                  value={emails}
                  aria-invalid={emailError || tooMany ? true : undefined}
                  aria-describedby="invite-emails-error"
                  onChange={(e) => {
                     setEmails(e.target.value);
                     setEmailError(null);
                  }}
               />
               <div className="flex min-w-0 shrink-0 items-center gap-2">
                  <RoleSelect
                     className="w-36 shrink-0"
                     label="Server role"
                     value={role}
                     roles={roles}
                     disabled={sendInvite.isPending}
                     onChange={(next) => setRole(next as GrantableRole)}
                  />
                  <Button
                     type="submit"
                     className="shrink-0"
                     loading={sendInvite.isPending}
                     disabled={tooMany || list.length === 0}
                  >
                     {list.length > 1
                        ? `Send ${list.length} invites`
                        : "Send invite"}
                  </Button>
               </div>
            </div>
            {list.length > 0 && (
               <ul className="flex min-w-0 flex-wrap gap-1.5">
                  {list.map((address) => {
                     const valid = emailSchema.safeParse(address).success;
                     return (
                        <li
                           key={address}
                           className={`flex max-w-full items-center gap-1 rounded-md py-0.5 pl-2 pr-1 text-xs ${
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
            <FormError id="invite-emails-error">
               {tooMany
                  ? `You can invite up to ${MAX_INVITE_EMAILS} people at a time`
                  : emailError}
            </FormError>
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
      </form>
   );
};

export default InviteForm;
