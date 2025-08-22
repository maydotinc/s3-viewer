import useDeleteObject from "@/lib/hooks/mutations/object/useDeleteObject";
import { Button } from "@s3-viewer/ui/components/button";
import {
   Dialog,
   DialogClose,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from "@s3-viewer/ui/components/dialog";
import { Trash2 } from "lucide-react";
import { useState } from "react";

type ConfirmDeleteModalProps = {
   onClose: () => void;
   serverId: string;
   bucketName: string;
   fileNames: string[];
   onDeleteSuccess?: () => void;
};

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
   onClose,
   serverId,
   bucketName,
   fileNames,
   onDeleteSuccess,
}) => {
   const deleteObjectMutation = useDeleteObject();
   const [deleteError, setDeleteError] = useState<string | null>(null);

   const handleDelete = () => {
      if (!bucketName || !serverId) {
         console.error(
            "Bucket name and server Id are required, cannot delete objects"
         );
         return;
      }
      deleteObjectMutation.mutate(
         { serverId, bucketName, fileNames },
         {
            onSuccess: () => {
               setDeleteError(null);
               onDeleteSuccess?.();
               onClose();
            },
            onError: (error: Error) => {
               setDeleteError(error.message);
            },
         }
      );
   };

   const fileCount = fileNames.length;
   const isMultiple = fileCount > 1;

   return (
      <Dialog open={true} onOpenChange={onClose}>
         <DialogContent className="max-w-[95%] xs:max-w-lg sm:max-w-md overflow-hidden">
            <DialogHeader className="flex flex-col items-center text-center gap-2">
               <DialogTitle>
                  <div className="flex flex-col gap-5 items-center">
                     <div className="bg-viewergray border border-xs rounded-2xl p-4">
                        <Trash2 className="size-7 text-red-500" />
                     </div>
                     <span>Delete {isMultiple ? "Objects" : "Object"}</span>
                  </div>
               </DialogTitle>
               <DialogDescription className="flex items-center text-center gap-2 flex-col">
                  <span>
                     Are you sure you want to delete{" "}
                     {isMultiple ? `${fileCount} objects` : `"${fileNames[0]}"`}
                     ? This action cannot be undone.
                  </span>
               </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col justify-center gap-2">
               <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleDelete}
                  disabled={deleteObjectMutation.isPending}
               >
                  {deleteObjectMutation.isPending
                     ? "Deleting..."
                     : `Delete ${isMultiple ? "Objects" : "Object"}`}
               </Button>
               <DialogClose asChild>
                  <Button variant="outline" className="w-full">
                     Cancel
                  </Button>
               </DialogClose>
            </DialogFooter>
            {deleteError && (
               <span className="text-red-500 text-sm text-center">
                  {deleteError}
               </span>
            )}
         </DialogContent>
      </Dialog>
   );
};

export default ConfirmDeleteModal;
