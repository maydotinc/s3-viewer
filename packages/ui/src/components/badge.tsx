import * as React from "react";

import { cn } from "@s3-viewer/ui/lib/utils";

const Badge = ({ className, ...props }: React.ComponentProps<"span">) => (
   <span
      data-slot="badge"
      className={cn(
         "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden select-none",
         "rounded-md border border-transparent bg-viewergray px-2 py-0.5 text-xs font-medium whitespace-nowrap text-viewerblack",
         "[&>svg]:pointer-events-none [&>svg:not([class*='size-'])]:size-3",
         className
      )}
      {...props}
   />
);

export { Badge };
