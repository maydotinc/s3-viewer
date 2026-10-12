import { cn } from "@s3-viewer/ui/lib/utils";
import { X } from "lucide-react";

type RemovableChipProps = {
   label: string;
   invalid?: boolean;
   title?: string;
   disabled?: boolean;
   onRemove: () => void;
};

const RemovableChip = ({
   label,
   invalid = false,
   title,
   disabled,
   onRemove,
}: RemovableChipProps) => (
   <li
      className={cn(
         "flex max-w-full items-center gap-1 rounded-md py-0.5 pr-1 pl-2 text-xs",
         invalid
            ? "bg-viewerbgred text-viewertextred"
            : "bg-viewergray text-viewerblack"
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
         className="shrink-0 cursor-pointer rounded-sm border border-transparent p-0.5 outline-none transition-colors hover:bg-viewerborder focus-visible:border-viewerblue disabled:opacity-50"
      >
         <X aria-hidden="true" className="size-3" />
      </button>
   </li>
);

export default RemovableChip;
