import { ConfirmDialog } from "@/components/Modals/confirm-dialog";
import useRemoveBucket from "@/lib/hooks/mutations/bucket/useRemoveBucket";
import { toastError } from "@/lib/utils/toast";
import { toast } from "@s3-viewer/ui/components/toast";

type RemoveBucketDialogProps = {
   bucketName: string;
   open: boolean;
   onOpenChange: (open: boolean) => void;
   onRemoved?: () => void;
};

const RemoveBucketDialog = ({
   bucketName,
   open,
   onOpenChange,
   onRemoved,
}: RemoveBucketDialogProps) => {
   const removeBucket = useRemoveBucket();

   const confirm = () =>
      removeBucket.mutate(bucketName, {
         onSuccess: () => {
            toast.success(`${bucketName} removed from this server.`);
            onOpenChange(false);
            onRemoved?.();
         },
         onError: toastError("Couldn't remove the bucket"),
      });

   return (
      <ConfirmDialog
         open={open}
         closable={!removeBucket.isPending}
         onClose={() => onOpenChange(false)}
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
         confirmVariant="destructive"
         confirmLabel="Remove bucket"
         isPending={removeBucket.isPending}
         onConfirm={confirm}
      />
   );
};

export default RemoveBucketDialog;
