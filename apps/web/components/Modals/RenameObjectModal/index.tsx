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
import { FilePen, Info } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import usePathSuggestion from "@/lib/hooks/usePathSuggestion";

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
   const [newKey, setNewKey] = useState(objectKey);
   const inputRef = useRef<HTMLInputElement>(null);

   const suggestion = usePathSuggestion(serverId, bucketName, newKey);

   const isUnchanged = newKey === objectKey;
   const isEmpty = newKey.trim().length === 0;

   const acceptSuggestion = useCallback(() => {
      if (!suggestion) return false;
      const nextSlash = suggestion.indexOf("/");
      const accepted =
         nextSlash >= 0 ? suggestion.substring(0, nextSlash + 1) : suggestion;
      setNewKey((prev) => prev + accepted);
      return true;
   }, [suggestion]);

   const handleRename = () => {
      if (!serverId || !bucketName || isEmpty || isUnchanged) return;

      renameObjectMutation.mutate(
         { serverId, bucketName, objectKey, newObjectKey: newKey },
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
                     Edit the full object key to rename or move this object.
                  </span>
               </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
               <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                     <label
                        htmlFor="newObjectKey"
                        className="text-sm font-medium text-black"
                     >
                        Object key
                     </label>
                     {suggestion && (
                        <span className="text-[11px] text-gray-400">
                           Tab to autocomplete
                        </span>
                     )}
                  </div>
                  <div className="relative">
                     <input
                        ref={inputRef}
                        id="newObjectKey"
                        type="text"
                        value={newKey}
                        onChange={(e) => {
                           setNewKey(e.target.value);
                           setRenameError(null);
                        }}
                        onKeyDown={(e) => {
                           if (e.key === "Tab" && suggestion) {
                              e.preventDefault();
                              acceptSuggestion();
                           } else if (
                              e.key === "Enter" &&
                              !isEmpty &&
                              !isUnchanged
                           ) {
                              handleRename();
                           }
                        }}
                        placeholder="path/to/file.ext"
                        autoFocus
                        autoComplete="off"
                        spellCheck={false}
                        className="border-input relative z-0 flex h-9 w-full min-w-0 rounded-lg border bg-white px-3 py-1 text-base transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                     />
                     <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 z-10 flex items-center px-3 text-base md:text-sm overflow-hidden whitespace-pre"
                     >
                        <span className="invisible">{newKey}</span>
                        <span className="text-gray-400">{suggestion}</span>
                     </div>
                  </div>
               </div>
               <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 p-3">
                  <Info className="size-4 text-viewerblue mt-0.5 shrink-0" />
                  <p className="text-xs text-viewerblue">
                     S3 does not natively support renaming. This will create a
                     copy at the new key and delete the original. Changing the
                     path will effectively move the object.
                  </p>
               </div>
            </div>
            <DialogFooter className="flex flex-row items-center w-full justify-center gap-2">
               <DialogClose asChild>
                  <Button variant="outline" className="w-full flex-1">
                     Cancel
                  </Button>
               </DialogClose>
               <Button
                  className="w-full flex-1"
                  onClick={handleRename}
                  disabled={
                     renameObjectMutation.isPending || isEmpty || isUnchanged
                  }
               >
                  {renameObjectMutation.isPending ? "Renaming..." : "Rename"}
               </Button>
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
