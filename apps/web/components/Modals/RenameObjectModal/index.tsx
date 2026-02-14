import useRenameObject from "@/lib/hooks/mutations/object/useRenameObject";
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
import { Input } from "@s3-viewer/ui/components/input";
import { FilePen, Info } from "lucide-react";
import { useMemo, useState } from "react";

type RenameObjectModalProps = {
   onClose: () => void;
   serverId: string;
   bucketName: string;
   objectKey: string;
   onRenameSuccess?: () => void;
};

const RenameObjectModal: React.FC<RenameObjectModalProps> = ({
   onClose,
   serverId,
   bucketName,
   objectKey,
   onRenameSuccess,
}) => {
   const renameObjectMutation = useRenameObject();
   const [renameError, setRenameError] = useState<string | null>(null);

   // Extract just the file name from the full key (strip prefix/path)
   const prefix = useMemo(() => {
      const lastSlash = objectKey.lastIndexOf("/");
      return lastSlash >= 0 ? objectKey.substring(0, lastSlash + 1) : "";
   }, [objectKey]);

   const originalName = useMemo(() => {
      const lastSlash = objectKey.lastIndexOf("/");
      return lastSlash >= 0 ? objectKey.substring(lastSlash + 1) : objectKey;
   }, [objectKey]);

   const [newName, setNewName] = useState(originalName);

   const newObjectKey = prefix + newName;
   const isUnchanged = newName === originalName;
   const isEmpty = newName.trim().length === 0;

   const handleRename = () => {
      if (!serverId || !bucketName || isEmpty || isUnchanged) return;

      renameObjectMutation.mutate(
         { serverId, bucketName, objectKey, newObjectKey },
         {
            onSuccess: () => {
               setRenameError(null);
               onRenameSuccess?.();
               onClose();
            },
            onError: (error: Error) => {
               setRenameError(error.message);
            },
         }
      );
   };

   return (
      <Dialog open={true} onOpenChange={onClose}>
         <DialogContent className="max-w-[95%] xs:max-w-lg sm:max-w-md overflow-hidden">
            <DialogHeader className="flex flex-col items-center text-center gap-2">
               <DialogTitle>
                  <div className="flex flex-col gap-5 items-center">
                     <div className="bg-viewergray border border-xs rounded-2xl p-4">
                        <FilePen className="size-7 text-viewerblue" />
                     </div>
                     <span>Rename Object</span>
                  </div>
               </DialogTitle>
               <DialogDescription className="flex items-center text-center gap-2 flex-col">
                  <span>
                     Enter a new name for{" "}
                     <span className="font-medium text-black">
                        &quot;{originalName}&quot;
                     </span>
                  </span>
               </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
               <div className="flex flex-col gap-2">
                  <label
                     htmlFor="newObjectName"
                     className="text-sm font-medium text-black"
                  >
                     New name
                  </label>
                  <Input
                     id="newObjectName"
                     value={newName}
                     onChange={(e) => {
                        setNewName(e.target.value);
                        setRenameError(null);
                     }}
                     onKeyDown={(e) => {
                        if (e.key === "Enter" && !isEmpty && !isUnchanged) {
                           handleRename();
                        }
                     }}
                     placeholder="Enter new file name"
                     autoFocus
                  />
               </div>
               <div className="flex items-start gap-2">
                  <Info className="size-4 text-viewerblue mt-0.5 shrink-0" />
                  <p className="text-xs text-viewertext">
                     S3 does not natively support renaming. This will create a
                     copy with the new name and then delete the original object.
                  </p>
               </div>
            </div>
            <DialogFooter className="flex flex-col justify-center gap-2">
               <Button
                  className="w-full"
                  onClick={handleRename}
                  disabled={
                     renameObjectMutation.isPending || isEmpty || isUnchanged
                  }
               >
                  {renameObjectMutation.isPending ? "Renaming..." : "Rename"}
               </Button>
               <DialogClose asChild>
                  <Button variant="outline" className="w-full">
                     Cancel
                  </Button>
               </DialogClose>
            </DialogFooter>
            {renameError && (
               <span className="text-red-500 text-sm text-center">
                  {renameError}
               </span>
            )}
         </DialogContent>
      </Dialog>
   );
};

export default RenameObjectModal;
