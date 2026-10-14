import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
} from "@s3-viewer/ui/components/dialog";
import type { ReactNode } from "react";

type ModalShellProps = {
   open?: boolean;
   closable?: boolean;
   showCloseButton?: boolean;
   onClose: () => void;
   title: ReactNode;
   description: ReactNode;
   className?: string;
   headerClassName?: string;
   children?: ReactNode;
};

const ModalShell = ({
   open = true,
   closable = true,
   showCloseButton = closable,
   onClose,
   title,
   description,
   className,
   headerClassName,
   children,
}: ModalShellProps) => (
   <Dialog
      open={open}
      onOpenChange={(next) => {
         if (!next && closable) onClose();
      }}
   >
      <DialogContent className={className} showCloseButton={showCloseButton}>
         <DialogHeader className={headerClassName}>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
         </DialogHeader>
         {children}
      </DialogContent>
   </Dialog>
);

export { ModalShell };
