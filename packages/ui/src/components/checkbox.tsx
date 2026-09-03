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
            "peer size-4 shrink-0 cursor-pointer rounded-[4px] border border-viewerborder bg-viewerwhite transition-colors outline-none",
            "data-[state=checked]:border-viewerblue data-[state=checked]:bg-viewerblue data-[state=checked]:text-viewerwhite",
            "data-[state=indeterminate]:border-viewerblue data-[state=indeterminate]:bg-viewerblue data-[state=indeterminate]:text-viewerwhite",
            "focus-visible:border-viewerblue aria-invalid:border-viewertextred",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
         )}
         {...props}
      >
         <CheckboxPrimitive.Indicator
            data-slot="checkbox-indicator"
            className="flex items-center justify-center text-current transition-none"
         >
            <CheckIcon className="size-4" />
         </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
   );
}

export { Checkbox };
