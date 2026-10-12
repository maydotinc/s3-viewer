import { Button } from "@s3-viewer/ui/components/button";
import { DialogBody, DialogFooter } from "@s3-viewer/ui/components/dialog";
import { cn } from "@s3-viewer/ui/lib/utils";
import type { FormEvent, ReactNode } from "react";
import { ModalShell, type DialogHeight } from "./modal-shell";

type FormDialogProps = {
   isPending?: boolean;
   onClose: () => void;
   title: ReactNode;
   description: ReactNode;
   height?: DialogHeight;
   contentClassName?: string;
   headerClassName?: string;
   bodyClassName?: string;
   formAutoComplete?: string;
   onSubmit: (event: FormEvent) => void;
   submitLabel: ReactNode;
   submitDisabled?: boolean;
   onAbort?: () => void;
   children?: ReactNode;
};

const FormDialog = ({
   isPending = false,
   onClose,
   title,
   description,
   height,
   contentClassName,
   headerClassName,
   bodyClassName = "flex flex-col gap-1.5",
   formAutoComplete,
   onSubmit,
   submitLabel,
   submitDisabled = false,
   onAbort,
   children,
}: FormDialogProps) => (
   <ModalShell
      closable={!isPending}
      showCloseButton
      onClose={onClose}
      title={title}
      description={description}
      height={height}
      className={contentClassName}
      headerClassName={headerClassName}
   >
      <form
         onSubmit={onSubmit}
         className="flex min-h-0 flex-1 flex-col"
         autoComplete={formAutoComplete}
      >
         <DialogBody className={cn("flex-1", bodyClassName)}>
            {children}
         </DialogBody>
         <DialogFooter>
            {isPending && onAbort && (
               <Button type="button" variant="outline" onClick={onAbort}>
                  Cancel
               </Button>
            )}
            <Button type="submit" loading={isPending} disabled={submitDisabled}>
               {submitLabel}
            </Button>
         </DialogFooter>
      </form>
   </ModalShell>
);

export { FormDialog };
