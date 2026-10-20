import FormError from "./form-error";
import { ModalShell } from "./modal-shell";
import { Button } from "@s3-viewer/ui/components/button";
import { DialogBody, DialogFooter } from "@s3-viewer/ui/components/dialog";
import { Children, type ReactNode } from "react";

type ConfirmDialogProps = {
   open?: boolean;
   closable?: boolean;
   onClose: () => void;
   title: ReactNode;
   description: ReactNode;
   error?: string | null;
   hint?: string;
   confirmLabel: string;
   confirmDisabled?: boolean;
   isPending?: boolean;
   confirmVariant?: "default" | "destructive";
   contentClassName?: string;
   // wraps the body in a form, so Enter in one of the children's inputs confirms
   form?: boolean;
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
   confirmLabel,
   confirmDisabled = false,
   isPending = false,
   confirmVariant = "default",
   contentClassName,
   form = false,
   onConfirm,
   onAbort,
   children,
}: ConfirmDialogProps) => {
   const showError = Boolean(error) || Boolean(hint);
   const hasBody = showError || Children.toArray(children).some(Boolean);
   const destructive = confirmVariant === "destructive";

   const content = (
      <>
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
               type={form ? "submit" : "button"}
               variant={confirmVariant}
               className={destructive ? "flex-1 sm:flex-initial" : undefined}
               onClick={form ? undefined : onConfirm}
               disabled={confirmDisabled}
               loading={isPending}
            >
               {confirmLabel}
            </Button>
         </DialogFooter>
      </>
   );

   return (
      <ModalShell
         open={open}
         closable={closable}
         showCloseButton={closable && !destructive}
         onClose={onClose}
         title={title}
         description={description}
         className={contentClassName}
      >
         {form ? (
            <form
               className="flex min-h-0 flex-1 flex-col"
               onSubmit={(event) => {
                  event.preventDefault();
                  onConfirm();
               }}
            >
               {content}
            </form>
         ) : (
            content
         )}
      </ModalShell>
   );
};

export { ConfirmDialog };
