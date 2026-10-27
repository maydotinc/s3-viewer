import IconTile, { type Tone } from "@/components/icon-tile";
import { Button } from "@s3-viewer/ui/components/button";
import { cn } from "@s3-viewer/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type StatusMessageProps = {
   icon: LucideIcon;
   title?: string;
   tone?: Tone;
   size?: "default" | "lg";
   children?: ReactNode;
   actions?: ReactNode;
   className?: string;
};

const StatusMessage = ({
   icon,
   title,
   tone = "neutral",
   size = "default",
   children,
   actions,
   className,
}: StatusMessageProps) => (
   <div
      role={tone === "error" ? "alert" : undefined}
      className={cn(
         "flex min-h-0 min-w-0 flex-1 items-center overflow-auto px-6 py-8 [justify-content:safe_center]",
         className
      )}
   >
      <div className="flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-center">
         <IconTile icon={icon} tone={tone} />
         <div className="flex min-w-0 flex-col gap-1">
            {title && (
               <p
                  className={cn(
                     "font-semibold text-viewerblack [overflow-wrap:anywhere]",
                     size === "lg" ? "text-base" : "text-sm"
                  )}
               >
                  {title}
               </p>
            )}
            {children && (
               <p className="text-sm text-viewertext [overflow-wrap:anywhere]">
                  {children}
               </p>
            )}
         </div>
         {actions && (
            <div className="flex flex-wrap items-center justify-center gap-2">
               {actions}
            </div>
         )}
      </div>
   </div>
);

type RetryProps = { onRetry: () => void; retrying?: boolean };

const RetryButton = ({
   onRetry,
   retrying,
   size,
}: RetryProps & { size?: "default" | "sm" }) => (
   <Button
      type="button"
      variant="outline"
      size={size}
      loading={retrying}
      onClick={onRetry}
   >
      Try again
   </Button>
);

export default StatusMessage;
export { RetryButton };
export type { RetryProps };
