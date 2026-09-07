import { Button } from "@s3-viewer/ui/components/button";
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from "@s3-viewer/ui/components/dialog";

const PREVIEW = 3;

type ReplaceDialogProps = {
   open: boolean;
   /** paths relative to the upload prefix, as shown to the user. */
   existing: string[];
   total: number;
   onReplaceAll: () => void;
   onSkipExisting: () => void;
   onCancel: () => void;
};

const ReplaceDialog = ({
   open,
   existing,
   total,
   onReplaceAll,
   onSkipExisting,
   onCancel,
}: ReplaceDialogProps) => {
   const names = existing.slice(0, PREVIEW).join(", ");
   const more =
      existing.length > PREVIEW ? ` and ${existing.length - PREVIEW} more` : "";
   const nothingToSkip = existing.length >= total;

   return (
      <Dialog
         open={open}
         onOpenChange={(next) => {
            if (!next) onCancel();
         }}
      >
         <DialogContent showCloseButton={false}>
            <DialogHeader>
               <DialogTitle>
                  {existing.length === 1
                     ? "Replace existing file?"
                     : "Replace existing files?"}
               </DialogTitle>
               <DialogDescription className="break-all">
                  {existing.length === 1
                     ? `${names} already exists in this folder.`
                     : `${existing.length} of the ${total} selected files already exist in this folder: ${names}${more}.`}{" "}
                  {nothingToSkip
                     ? "Skipping them would upload nothing."
                     : "Replace them, or skip them and upload only the new files."}
               </DialogDescription>
            </DialogHeader>
            <DialogFooter>
               <Button
                  type="button"
                  variant="outline"
                  className="flex-1 sm:flex-initial"
                  onClick={onCancel}
               >
                  Cancel
               </Button>
               <Button
                  type="button"
                  variant="outline"
                  className="flex-1 sm:flex-initial"
                  disabled={nothingToSkip}
                  onClick={onSkipExisting}
               >
                  Skip existing
               </Button>
               <Button
                  type="button"
                  className="flex-1 sm:flex-initial"
                  onClick={onReplaceAll}
               >
                  Replace all
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
   );
};

export { ReplaceDialog };
