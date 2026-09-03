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
import {
   Select,
   SelectContent,
   SelectTrigger,
   SelectValue,
} from "@s3-viewer/ui/components/select";
import { X } from "lucide-react";
import { FormEvent, useState } from "react";
import BucketAccessPicker from "./bucket-access-picker";
import RoleSelectItems from "./role-options";
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
      <form onSubmit={submit} className="flex flex-col gap-3">
         <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-emails">Email addresses</Label>
            <div className="flex gap-2">
               <Input
                  id="invite-emails"
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  placeholder="name@example.com, another@example.com"
                  value={emails}
                  aria-invalid={emailError || tooMany ? true : undefined}
                  aria-describedby="invite-emails-error"
                  onChange={(e) => {
                     setEmails(e.target.value);
                     setEmailError(null);
                  }}
               />
               <Select
                  value={role}
                  onValueChange={(v) => setRole(v as GrantableRole)}
               >
                  <SelectTrigger
                     className="w-32 shrink-0"
                     aria-label="Server role"
                  >
                     <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                     <RoleSelectItems roles={roles} />
                  </SelectContent>
               </Select>
            </div>
            {list.length > 0 && (
               <ul className="flex flex-wrap gap-1.5">
                  {list.map((address) => {
                     const valid = emailSchema.safeParse(address).success;
                     return (
                        <li
                           key={address}
                           className={`flex max-w-full items-center gap-1 rounded-md border py-0.5 pl-2 pr-1 text-xs ${
                              valid
                                 ? "border-viewerborder bg-viewergray text-viewerblack"
                                 : "border-viewertextred bg-viewerbgred text-viewertextred"
                           }`}
                        >
                           <span className="truncate">{address}</span>
                           <button
                              type="button"
                              aria-label={`Remove ${address}`}
                              disabled={sendInvite.isPending}
                              onClick={() => removeEmail(address)}
                              className="rounded-sm p-0.5 outline-none hover:bg-viewerborder focus-visible:ring-[3px] focus-visible:ring-viewerblue/40 disabled:opacity-50"
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
         <Button
            type="submit"
            loading={sendInvite.isPending}
            disabled={tooMany}
         >
            {sendInvite.isPending
               ? "Sending…"
               : list.length > 1
                 ? `Send ${list.length} invites`
                 : "Send invite"}
         </Button>
      </form>
   );
};

export default InviteForm;
