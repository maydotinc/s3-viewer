import { FOCUS_RING } from "@s3-viewer/ui/lib/classes";
import { cn } from "@s3-viewer/ui/lib/utils";
import { X } from "lucide-react";

type RemovableChipProps = {
   label: string;
   invalid?: boolean;
   title?: string;
   disabled?: boolean;
   className?: string;
   onRemove: () => void;
};

const RemovableChip = ({
   label,
   invalid = false,
   title,
   disabled,
   className,
   onRemove,
}: RemovableChipProps) => (
   <li
      className={cn(
         "flex max-w-full items-center gap-1 rounded-md py-0.5 pr-1 pl-2 text-xs",
         invalid
            ? "bg-viewerbgred text-viewertextred"
            : "bg-viewergray text-viewerblack",
         className
      )}
   >
      <span className="min-w-0 truncate" title={title}>
         {label}
      </span>
      <button
         type="button"
         aria-label={`Remove ${label}`}
         disabled={disabled}
         onClick={onRemove}
         className={cn(
            "shrink-0 cursor-pointer rounded-sm p-0.5 outline-none transition-colors hover:bg-viewerborder disabled:opacity-50",
            FOCUS_RING
         )}
      >
         <X aria-hidden="true" className="size-3" />
      </button>
   </li>
);

export default RemovableChip;
