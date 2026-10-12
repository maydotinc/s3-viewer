import { cn } from "@s3-viewer/ui/lib/utils";
import type { ReactNode } from "react";

export const FadePanel = ({
   active,
   className,
   children,
}: {
   active: boolean;
   className?: string;
   children: ReactNode;
}) => (
   <div
      inert={!active}
      className={cn(
         "absolute inset-0 transition-[opacity,transform] motion-reduce:transition-none",
         active
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-1 opacity-0",
         className
      )}
   >
      {children}
   </div>
);
