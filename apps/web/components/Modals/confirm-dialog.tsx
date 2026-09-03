import FormError from "@/components/Modals/form-error";
import { Button } from "@s3-viewer/ui/components/button";
import {
   Dialog,
   DialogClose,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from "@s3-viewer/ui/components/dialog";
import { cn } from "@s3-viewer/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Tone = "default" | "destructive";

const ICON_TONE: Record<Tone, string> = {
   default: "text-viewerblue",
   destructive: "text-viewertextred",
};

type CenteredDialogHeaderProps = {
   icon: LucideIcon;
   tone?: Tone;
   title: ReactNode;
   descriptionClassName?: string;
   children: ReactNode;
};

const CenteredDialogHeader = ({
   icon: Icon,
   tone = "default",
   title,
   descriptionClassName,
   children,
}: CenteredDialogHeaderProps) => (
   <DialogHeader className="items-center text-center">
      <div className="rounded-2xl border border-viewerborder bg-viewergray p-4">
         <Icon className={cn("size-7", ICON_TONE[tone])} aria-hidden="true" />
      </div>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription className={descriptionClassName}>
         {children}
      </DialogDescription>
   </DialogHeader>
);

type ConfirmFooterProps = { cancelDisabled?: boolean; children: ReactNode };

const ConfirmFooter = ({ cancelDisabled, children }: ConfirmFooterProps) => (
   <DialogFooter className="gap-2 sm:flex-row">
      <DialogClose asChild>
         <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={cancelDisabled}
         >
            Cancel
         </Button>
      </DialogClose>
      {children}
   </DialogFooter>
);

type ConfirmDialogProps = {
   open?: boolean;
   closable?: boolean;
   onClose: () => void;
   icon?: LucideIcon;
   tone?: Tone;
   title: ReactNode;
   description: ReactNode;
   descriptionClassName?: string;
   error?: string | null;
   confirmLabel: string;
   pendingLabel?: string;
   isPending?: boolean;
   confirmVariant?: Tone;
   onConfirm: () => void;
};

const ConfirmDialog = ({
   open = true,
   closable = true,
   onClose,
   icon,
   tone,
   title,
   description,
   descriptionClassName,
   error,
   confirmLabel,
   pendingLabel,
   isPending = false,
   confirmVariant = "default",
   onConfirm,
}: ConfirmDialogProps) => {
   const label = isPending && pendingLabel ? pendingLabel : confirmLabel;
   return (
      <Dialog
         open={open}
         onOpenChange={(next) => {
            if (!next && closable) onClose();
         }}
      >
         <DialogContent
            className={icon ? "max-w-[95%] sm:max-w-md" : "sm:max-w-md"}
         >
            {icon ? (
               <CenteredDialogHeader
                  icon={icon}
                  tone={tone}
                  title={title}
                  descriptionClassName={descriptionClassName}
               >
                  {description}
               </CenteredDialogHeader>
            ) : (
               <DialogHeader className="text-left">
                  <DialogTitle>{title}</DialogTitle>
                  <DialogDescription className={descriptionClassName}>
                     {description}
                  </DialogDescription>
               </DialogHeader>
            )}
            {error !== undefined && <FormError>{error}</FormError>}
            {icon ? (
               <ConfirmFooter cancelDisabled={isPending}>
                  <Button
                     variant={confirmVariant}
                     className="flex-1"
                     onClick={onConfirm}
                     loading={isPending}
                  >
                     {label}
                  </Button>
               </ConfirmFooter>
            ) : (
               <DialogFooter className="sm:justify-end">
                  <Button
                     variant="outline"
                     onClick={onClose}
                     disabled={isPending}
                  >
                     Cancel
                  </Button>
                  <Button
                     variant={confirmVariant}
                     onClick={onConfirm}
                     loading={isPending}
                  >
                     {label}
                  </Button>
               </DialogFooter>
            )}
         </DialogContent>
      </Dialog>
   );
};

export { CenteredDialogHeader, ConfirmDialog, ConfirmFooter };
