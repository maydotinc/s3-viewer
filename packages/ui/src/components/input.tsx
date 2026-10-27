import * as React from "react";

import { cn } from "@s3-viewer/ui/lib/utils";

function Input({ className, ...props }: React.ComponentProps<"input">) {
   return (
      <input
         className={cn(
            "flex h-9 w-full min-w-0 rounded-lg border border-viewerborder bg-viewerwhite px-3 text-base text-viewerblack sm:text-sm transition-colors outline-none pointer-coarse:min-h-11",
            "placeholder:text-viewerlighttext selection:bg-viewerblue selection:text-viewerwhite",
            "focus:border-viewerblue aria-invalid:border-viewertextred",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
         )}
         {...props}
      />
   );
}

export { Input };
