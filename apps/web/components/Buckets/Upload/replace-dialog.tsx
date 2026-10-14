import { pluralize, visibleText } from "@/lib/utils/format";
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
   existing: string[];
   pendingFileCount: number;
   dropFileCount: number;
   onReplaceAll: () => void;
   onSkipExisting: () => void;
   onCancel: () => void;
};

const ReplaceDialog = ({
   open,
   existing,
   pendingFileCount,
   dropFileCount,
   onReplaceAll,
   onSkipExisting,
   onCancel,
}: ReplaceDialogProps) => {
   const names = existing.slice(0, PREVIEW).map(visibleText).join(", ");
   const more =
      existing.length > PREVIEW ? ` and ${existing.length - PREVIEW} more` : "";
   const uploadingFileCount = Math.max(dropFileCount - pendingFileCount, 0);
   const nothingToSkip = existing.length >= pendingFileCount;
   const summary =
      existing.length === 1
         ? `${names} already exists in this folder.`
         : `${existing.length} of the ${dropFileCount} selected files already exist in this folder: ${names}${more}.`;
   const advice = nothingToSkip
      ? `Skipping them would upload nothing${uploadingFileCount > 0 ? " more" : ""}.`
      : "Replace them, or skip them and upload only the new files.";
   const inFlight =
      uploadingFileCount > 0
         ? ` The other ${pluralize(uploadingFileCount, "file")} in this drop ${uploadingFileCount === 1 ? "is" : "are"} already uploading.`
         : "";

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
                  {summary} {advice}
                  {inFlight}
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
