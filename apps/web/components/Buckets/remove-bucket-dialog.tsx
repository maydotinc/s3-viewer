import { ConfirmDialog } from "@/components/Modals/confirm-dialog";
import { ApiError, isAborted } from "@/lib/api";
import useRemoveBucket from "@/lib/hooks/mutations/bucket/useRemoveBucket";
import { toast } from "@s3-viewer/ui/components/toast";
import { useState } from "react";

type RemoveBucketDialogProps = {
   bucketName: string;
   open: boolean;
   onOpenChange: (open: boolean) => void;
   onRemoved?: () => void;
};

const isPermanent = (error: Error | null): boolean =>
   error instanceof ApiError && error.status === 409;

const RemoveBucketDialog = ({
   bucketName,
   open,
   onOpenChange,
   onRemoved,
}: RemoveBucketDialogProps) => {
   const removeBucket = useRemoveBucket();
   const [error, setError] = useState<Error | null>(null);
   const blocked = isPermanent(error);

   const close = () => {
      setError(null);
      onOpenChange(false);
   };

   const confirm = () => {
      if (blocked || removeBucket.isPending) return;
      setError(null);
      removeBucket.mutate(bucketName, {
         onSuccess: () => {
            toast.success(`${bucketName} removed from this server.`);
            close();
            onRemoved?.();
         },
         onError: (failure) => {
            if (isAborted(failure)) return;
            setError(failure);
         },
      });
   };

   return (
      <ConfirmDialog
         open={open}
         closable={!removeBucket.isPending}
         onClose={close}
         title="Remove bucket"
         description={
            <>
               This removes{" "}
               <span className="font-medium text-viewerblack">
                  {bucketName}
               </span>{" "}
               from this server for every member. Nothing in S3 is deleted.
            </>
         }
         error={error?.message}
         confirmDisabled={blocked}
         confirmVariant="destructive"
         confirmLabel="Remove bucket"
         isPending={removeBucket.isPending}
         onConfirm={confirm}
      />
   );
};

export default RemoveBucketDialog;
