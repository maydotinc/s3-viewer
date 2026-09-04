import * as React from "react";

import { cn } from "@s3-viewer/ui/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
   return (
      <input
         type={type}
         data-slot="input"
         className={cn(
            "flex h-9 w-full min-w-0 rounded-lg border border-viewerborder bg-viewerwhite px-3 text-sm text-viewerblack transition-colors outline-none",
            "placeholder:text-viewerlighttext selection:bg-viewerblue selection:text-viewerwhite",
            "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-viewerblack",
            // focus is a border swap — never a ring
            "focus-visible:border-viewerblue aria-invalid:border-viewertextred",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
         )}
         {...props}
      />
   );
}

export { Input };
