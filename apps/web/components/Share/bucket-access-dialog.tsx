import { FormDialog } from "@/components/Modals/form-dialog";
import useUpdateRole from "@/lib/hooks/mutations/invites/useUpdateRole";
import {
   BucketAccessEntry,
   GrantableRole,
   Role,
   S3Bucket,
   ServerUser,
} from "@s3-viewer/types";
import { FormEvent, useState } from "react";
import BucketAccessPicker from "./bucket-access-picker";

type BucketAccessDialogProps = {
   serverId: string;
   myRole: Role;
   buckets: S3Bucket[];
   isBucketsLoading: boolean;
   member: ServerUser;
   onClose: () => void;
};

const accessKey = (entries: BucketAccessEntry[]): string =>
   entries
      .map((entry) => `${entry.bucketName}:${entry.role}`)
      .sort()
      .join(",");

const BucketAccessDialog = ({
   serverId,
   myRole,
   buckets,
   isBucketsLoading,
   member,
   onClose,
}: BucketAccessDialogProps) => {
   const [access, setAccess] = useState<BucketAccessEntry[]>(
      member.bucketAccess
   );
   const updateRole = useUpdateRole();
   const canSave =
      access.length > 0 && accessKey(access) !== accessKey(member.bucketAccess);

   const submit = (event: FormEvent) => {
      event.preventDefault();
      if (!canSave) return;
      updateRole.mutate(
         {
            serverId,
            userId: member.id,
            role: member.role as GrantableRole,
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
         isPending={updateRole.isPending}
         title="Bucket access"
         description={`${member.name} · ${member.email}`}
         contentClassName="max-w-lg"
         onSubmit={submit}
         submitLabel="Save"
         submitDisabled={!canSave}
      >
         <BucketAccessPicker
            label={`Bucket access for ${member.name}`}
            myRole={myRole}
            buckets={buckets}
            isLoading={isBucketsLoading}
            value={access}
            onChange={setAccess}
            disabled={updateRole.isPending}
         />
      </FormDialog>
   );
};

export default BucketAccessDialog;
