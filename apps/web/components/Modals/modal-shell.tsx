import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
} from "@s3-viewer/ui/components/dialog";
import { cn } from "@s3-viewer/ui/lib/utils";
import type { ReactNode } from "react";

const DIALOG_HEIGHT = {
   sm: "h-[min(34rem,calc(100dvh-2rem))]",
   md: "h-[min(40rem,calc(100dvh-2rem))]",
   lg: "h-[min(44rem,calc(100dvh-2rem))]",
   xl: "h-[min(48rem,calc(100dvh-2rem))]",
} as const;

type DialogHeight = keyof typeof DIALOG_HEIGHT;

type ModalShellProps = {
   open?: boolean;
   closable?: boolean;
   showCloseButton?: boolean;
   onClose: () => void;
   title: ReactNode;
   description: ReactNode;
   height?: DialogHeight;
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
   height,
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
      <DialogContent
         className={cn(height && DIALOG_HEIGHT[height], className)}
         showCloseButton={showCloseButton}
      >
         <DialogHeader className={headerClassName}>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
         </DialogHeader>
         {children}
      </DialogContent>
   </Dialog>
);

export { ModalShell };
export type { DialogHeight };
