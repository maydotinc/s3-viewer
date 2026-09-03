import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@s3-viewer/ui/lib/utils";

function Checkbox({
   className,
   ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
   return (
      <CheckboxPrimitive.Root
         data-slot="checkbox"
         className={cn(
            "peer border-input data-[state=checked]:bg-viewerblue data-[state=checked]:text-viewerwhite data-[state=checked]:border-viewerblue focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-30",
            className
         )}
         {...props}
      >
         <CheckboxPrimitive.Indicator
            data-slot="checkbox-indicator"
            className="flex items-center justify-center transition-none"
         >
            <CheckIcon className="size-4" />
         </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
   );
}

export { Checkbox };
