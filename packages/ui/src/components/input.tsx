import * as React from "react";

import { cn } from "@s3-viewer/ui/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
   return (
      <input
         type={type}
         data-slot="input"
         className={cn(
            "file:text-foreground placeholder:text-viewerlighttext selection:bg-viewerblue selection:text-viewerwhite border-input flex h-9 w-full min-w-0 rounded-lg border bg-transparent px-3 py-1 text-base transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            "focus-visible:border-viewerblue focus-visible:ring-[3px] focus-visible:ring-viewerblue/30",
            "aria-invalid:ring-[3px] aria-invalid:ring-viewertextred/20 aria-invalid:border-viewertextred",
            className
         )}
         {...props}
      />
   );
}

export { Input };
