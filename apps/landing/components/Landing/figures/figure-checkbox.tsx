import { cn } from "@s3-viewer/ui/lib/utils";
import { Check } from "lucide-react";

export const FigureCheckbox = ({
   checked = false,
   strokeWidth = 3,
   className,
}: {
   checked?: boolean;
   strokeWidth?: number;
   className?: string;
}) => (
   <span
      className={cn(
         "grid size-4 shrink-0 place-items-center rounded-[4px] border",
         checked
            ? "border-viewerblue bg-viewerblue text-viewerwhite"
            : "border-viewerborder bg-viewerwhite",
         className
      )}
   >
      {checked && <Check className="size-3" strokeWidth={strokeWidth} />}
   </span>
);
