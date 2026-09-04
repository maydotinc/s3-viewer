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
import type { FormEvent, ReactNode } from "react";

type FormDialogProps = {
   open?: boolean;
   isPending?: boolean;
   onClose: () => void;
   title: ReactNode;
   description: ReactNode;
   contentClassName?: string;
   headerClassName?: string;
   bodyClassName?: string;
   formAutoComplete?: string;
   onSubmit: (event: FormEvent) => void;
   submitLabel: ReactNode;
   submitDisabled?: boolean;
   children?: ReactNode;
};

const FormDialog = ({
   open = true,
   isPending = false,
   onClose,
   title,
   description,
   contentClassName,
   headerClassName,
   bodyClassName = "flex flex-col gap-1.5",
   formAutoComplete,
   onSubmit,
   submitLabel,
   submitDisabled = false,
   children,
}: FormDialogProps) => {
   return (
      <Dialog open={open} onOpenChange={isPending ? undefined : onClose}>
         <DialogContent className={contentClassName}>
            <DialogHeader className={headerClassName}>
               <DialogTitle>{title}</DialogTitle>
               <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <form
               onSubmit={onSubmit}
               className="flex min-h-0 flex-col"
               autoComplete={formAutoComplete}
            >
               <DialogBody className={bodyClassName}>{children}</DialogBody>
               <DialogFooter>
                  <Button
                     type="submit"
                     loading={isPending}
                     disabled={submitDisabled}
                  >
                     {submitLabel}
                  </Button>
               </DialogFooter>
            </form>
         </DialogContent>
      </Dialog>
   );
};

export { FormDialog };
