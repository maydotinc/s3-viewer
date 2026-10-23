import { FormDialog } from "@/components/Modals/form-dialog";
import StaleSignIn, { isSessionStale } from "@/components/stale-sign-in";
import useUpdateRole from "@/lib/hooks/mutations/invites/useUpdateRole";
import type {
   BucketAccessEntry,
   GrantableRole,
   Role,
   S3Bucket,
   ServerUser,
} from "@s3-viewer/types";
import { useState, type FormEvent } from "react";
import BucketAccessPicker from "./bucket-access-picker";
import {
   TOO_MANY_BUCKETS,
   accessErrors,
   accessKey,
   accessSummaryError,
   commitDrafts,
   grantPayload,
   hasDrafts,
   tooManyBuckets,
   type GrantRow,
} from "./bucket-grants";

type BucketAccessDialogProps = {
   serverId: string;
   myRole: Role;
   buckets: S3Bucket[];
   isBucketsLoading: boolean;
   member: ServerUser;
   onClose: () => void;
};

const BucketAccessDialog = ({
   serverId,
   myRole,
   buckets,
   isBucketsLoading,
   member,
   onClose,
}: BucketAccessDialogProps) => {
   const [loaded] = useState<BucketAccessEntry[]>(member.bucketAccess);
   const [access, setAccess] = useState<GrantRow[]>(loaded);
   const [submitted, setSubmitted] = useState(false);
   const [conflict, setConflict] = useState<string | null>(null);
   const updateRole = useUpdateRole();
   const check = {
      buckets,
      myRole,
      originals: loaded,
      serverRole: member.role,
   };
   const canSave =
      conflict === null &&
      (accessKey(access) !== accessKey(loaded) || hasDrafts(access));
   const [invalid] = accessErrors(access, { ...check, drafts: true });

   const submit = (event: FormEvent) => {
      event.preventDefault();
      if (!canSave) return;
      setSubmitted(true);
      const committed = commitDrafts(access, check);
      setAccess(committed);
      const [refused] = accessErrors(committed, { ...check, drafts: true });
      if (
         refused ||
         tooManyBuckets(committed) ||
         accessKey(committed) === accessKey(loaded)
      )
         return;
      updateRole.mutate(
         {
            serverId,
            userId: member.id,
            role: member.role as GrantableRole,
            bucketAccess: grantPayload(committed),
            previousBucketAccess: grantPayload(loaded),
         },
         {
            onSuccess: onClose,
            onError: (error) => {
               if (error.status === 409) setConflict(error.message);
            },
         }
      );
   };

   return (
      <FormDialog
         onClose={onClose}
         isPending={updateRole.isPending}
         title="Bucket access"
         description={`${member.name} · ${member.email}`}
         contentClassName="max-w-lg"
         onSubmit={submit}
         submitLabel="Save"
         submitDisabled={!canSave}
      >
         <BucketAccessPicker
            serverId={serverId}
            label={`Bucket access for ${member.name}`}
            myRole={myRole}
            buckets={buckets}
            isLoading={isBucketsLoading}
            value={access}
            onChange={setAccess}
            original={loaded}
            serverRole={member.role}
            showErrors={submitted}
            error={
               conflict ??
               (!submitted
                  ? null
                  : invalid
                    ? accessSummaryError(invalid)
                    : tooManyBuckets(access)
                      ? TOO_MANY_BUCKETS
                      : null)
            }
            disabled={updateRole.isPending || conflict !== null}
         />
         {isSessionStale(updateRole.error) && (
            <StaleSignIn
               title="Sign in again to change an admin's access"
               action="changing an admin's access"
            />
         )}
      </FormDialog>
   );
};

export default BucketAccessDialog;
