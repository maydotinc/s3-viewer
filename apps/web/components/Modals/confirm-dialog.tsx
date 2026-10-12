import FormError from "./form-error";
import { ModalShell } from "./modal-shell";
import { Button } from "@s3-viewer/ui/components/button";
import { DialogBody, DialogFooter } from "@s3-viewer/ui/components/dialog";
import type { ReactNode } from "react";

type ConfirmDialogProps = {
   open?: boolean;
   closable?: boolean;
   onClose: () => void;
   title: ReactNode;
   description: ReactNode;
   error?: string | null;
   hint?: string;
   reserveErrorSpace?: boolean;
   confirmLabel: string;
   confirmDisabled?: boolean;
   isPending?: boolean;
   confirmVariant?: "default" | "destructive";
   onConfirm: () => void;
   onAbort?: () => void;
   children?: ReactNode;
};

const ConfirmDialog = ({
   open = true,
   closable = true,
   onClose,
   title,
   description,
   error,
   hint,
   reserveErrorSpace = false,
   confirmLabel,
   confirmDisabled = false,
   isPending = false,
   confirmVariant = "default",
   onConfirm,
   onAbort,
   children,
}: ConfirmDialogProps) => {
   const showError = reserveErrorSpace || Boolean(error) || Boolean(hint);
   const hasBody = showError || children !== undefined;
   const destructive = confirmVariant === "destructive";

   return (
      <ModalShell
         open={open}
         closable={closable}
         showCloseButton={!destructive}
         onClose={onClose}
         title={title}
         description={description}
      >
         {hasBody && (
            <DialogBody className="flex flex-col gap-1.5">
               {showError && <FormError hint={hint}>{error}</FormError>}
               {children}
            </DialogBody>
         )}
         <DialogFooter>
            {destructive && (
               <Button
                  type="button"
                  variant="outline"
                  className="flex-1 sm:flex-initial"
                  onClick={isPending && onAbort ? onAbort : onClose}
                  disabled={isPending && !onAbort}
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
      </ModalShell>
   );
};

export { ConfirmDialog };
