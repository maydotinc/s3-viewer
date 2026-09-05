import { cn } from "@s3-viewer/ui/lib/utils";
import type { ReactNode } from "react";

const Callout = ({
   className,
   children,
}: {
   className?: string;
   children: ReactNode;
}) => (
   <div
      className={cn(
         "flex min-w-0 flex-col items-start gap-2 rounded-lg bg-viewergray px-4 py-3 text-sm text-viewertext",
         className
      )}
   >
      {children}
   </div>
);

export default Callout;
