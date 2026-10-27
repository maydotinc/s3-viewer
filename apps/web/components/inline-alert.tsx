import { cn } from "@s3-viewer/ui/lib/utils";
import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

type InlineAlertProps = {
   children: ReactNode;
   title?: string;
   action?: ReactNode;
   variant?: "panel" | "plain";
   truncate?: boolean;
   className?: string;
};

const ICON = "size-4 shrink-0 text-viewertextred";

const tooltip = (children: ReactNode): string | undefined =>
   typeof children === "string" ? children : undefined;

const InlineAlert = ({
   children,
   title,
   action,
   variant = "panel",
   truncate = false,
   className,
}: InlineAlertProps) => {
   if (title)
      return (
         <div
            role="alert"
            className={cn(
               "flex min-w-0 flex-col items-start gap-1.5 rounded-lg bg-viewergray px-3 py-2.5",
               className
            )}
         >
            <p className="flex items-center gap-2 text-sm font-medium text-viewerblack">
               <CircleAlert aria-hidden="true" className={ICON} />
               {title}
            </p>
            <p
               title={tooltip(children)}
               className="line-clamp-3 text-xs text-viewertext [overflow-wrap:anywhere]"
            >
               {children}
            </p>
            {action}
         </div>
      );
   if (variant === "plain")
      return (
         <p
            role="alert"
            title={truncate ? tooltip(children) : undefined}
            className={cn(
               "flex min-w-0 gap-2 text-sm text-viewerblack",
               truncate
                  ? "items-center"
                  : "items-start [overflow-wrap:anywhere]",
               className
            )}
         >
            <CircleAlert
               aria-hidden="true"
               className={cn(ICON, !truncate && "mt-0.5")}
            />
            {truncate ? (
               <span className="min-w-0 truncate">{children}</span>
            ) : (
               children
            )}
         </p>
      );
   return (
      <div
         role="alert"
         className={cn(
            "flex min-w-0 items-center gap-3 rounded-lg bg-viewerbgred/60 py-2 pr-2 pl-3 text-sm",
            className
         )}
      >
         <CircleAlert aria-hidden="true" className={ICON} />
         <p className="min-w-0 flex-1 py-1 text-viewerblack [overflow-wrap:anywhere]">
            {children}
         </p>
         {action && <div className="shrink-0">{action}</div>}
      </div>
   );
};

export default InlineAlert;
