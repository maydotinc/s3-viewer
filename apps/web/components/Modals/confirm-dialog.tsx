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
   /** Whether Escape or an overlay click may close the dialog. */
   closable?: boolean;
   onClose: () => void;
   title: ReactNode;
   /** One sentence describing the consequence of confirming. */
   description: ReactNode;
   descriptionClassName?: string;
   /** Reserves a single error line under the header when not undefined. */
   error?: string | null;
   confirmLabel: string;
   isPending?: boolean;
   confirmVariant?: "default" | "destructive";
   onConfirm: () => void;
   /** Optional body below the error line. */
   children?: ReactNode;
};

/**
 * The one confirmation dialog.
 *
 * A destructive confirm is the single place a Cancel button is allowed: the X
 * is hidden and Cancel sits next to the destructive action. Every other
 * confirm keeps the X and shows only its primary action.
 */
const ConfirmDialog = ({
   open = true,
   closable = true,
   onClose,
   title,
   description,
   descriptionClassName,
   error,
   confirmLabel,
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
