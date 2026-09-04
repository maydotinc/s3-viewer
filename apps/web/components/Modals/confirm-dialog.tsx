import FormError from "@/components/Modals/form-error";
import { Button } from "@s3-viewer/ui/components/button";
import {
   Dialog,
   DialogBody,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from "@s3-viewer/ui/components/dialog";
import type { ReactNode } from "react";

type ConfirmDialogProps = {
   open?: boolean;
   closable?: boolean;
   onClose: () => void;
   title: ReactNode;
   description: ReactNode;
   descriptionClassName?: string;
   /** anything but undefined reserves an error line under the header. */
   error?: string | null;
   confirmLabel: string;
   confirmDisabled?: boolean;
   isPending?: boolean;
   confirmVariant?: "default" | "destructive";
   onConfirm: () => void;
   children?: ReactNode;
};

const ConfirmDialog = ({
   open = true,
   closable = true,
   onClose,
   title,
   description,
   descriptionClassName,
   error,
   confirmLabel,
   confirmDisabled = false,
   isPending = false,
   confirmVariant = "default",
   onConfirm,
   children,
}: ConfirmDialogProps) => {
   const hasBody = error !== undefined || children !== undefined;
   const destructive = confirmVariant === "destructive";

   return (
      <Dialog
         open={open}
         onOpenChange={(next) => {
            if (!next && closable) onClose();
         }}
      >
         <DialogContent showCloseButton={!destructive}>
            <DialogHeader>
               <DialogTitle>{title}</DialogTitle>
               <DialogDescription className={descriptionClassName}>
                  {description}
               </DialogDescription>
            </DialogHeader>
            {hasBody && (
               <DialogBody className="flex flex-col gap-1.5">
                  {error !== undefined && <FormError>{error}</FormError>}
                  {children}
               </DialogBody>
            )}
            <DialogFooter>
               {destructive && (
                  <Button
                     type="button"
                     variant="outline"
                     className="flex-1 sm:flex-initial"
                     onClick={onClose}
                     disabled={isPending}
                  >
                     Cancel
                  </Button>
               )}
               <Button
                  type="button"
                  variant={confirmVariant}
                  className={destructive ? "flex-1 sm:flex-initial" : undefined}
                  onClick={onConfirm}
                  disabled={confirmDisabled}
                  loading={isPending}
               >
                  {confirmLabel}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
   );
};

export { ConfirmDialog };
