import { ConfirmDialog } from "./confirm-dialog";
import { Button } from "@s3-viewer/ui/components/button";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import { useState, type ComponentProps } from "react";

type ConfirmButtonProps = Omit<
   ComponentProps<typeof Button>,
   "onClick" | "loading" | "type"
> & {
   tooltip?: string;
   confirmTitle: string;
   confirmDescription: string;
   confirmLabel: string;
   isPending: boolean;
   onConfirm: (close: () => void) => void;
};

const ConfirmButton = ({
   tooltip,
   confirmTitle,
   confirmDescription,
   confirmLabel,
   isPending,
   onConfirm,
   ...button
}: ConfirmButtonProps) => {
   const [open, setOpen] = useState(false);
   const close = () => setOpen(false);
   const trigger = (
      <Button
         type="button"
         loading={isPending}
         onClick={() => setOpen(true)}
         {...button}
      />
   );
   return (
      <>
         {tooltip ? (
            <SimpleTooltip label={tooltip}>{trigger}</SimpleTooltip>
         ) : (
            trigger
         )}
         {open && (
            <ConfirmDialog
               closable={!isPending}
               onClose={close}
               title={confirmTitle}
               description={confirmDescription}
               confirmVariant="destructive"
               confirmLabel={confirmLabel}
               isPending={isPending}
               onConfirm={() => onConfirm(close)}
            />
         )}
      </>
   );
};

export { ConfirmButton };
