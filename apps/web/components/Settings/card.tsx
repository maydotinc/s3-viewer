import { cn } from "@s3-viewer/ui/lib/utils";
import type { ReactNode } from "react";

const FORM_GRID = "grid min-w-0 gap-4 @xl:grid-cols-2";

type SettingsCardProps = {
   title: string;
   description?: ReactNode;
   action?: ReactNode;
   flush?: boolean;
   className?: string;
   children: ReactNode;
};

const SettingsCard = ({
   title,
   description,
   action,
   flush = false,
   className,
   children,
}: SettingsCardProps) => (
   <section
      aria-label={title}
      className={cn(
         "@container min-w-0 shrink-0 rounded-xl border border-viewerborder bg-viewerwhite",
         flush ? "overflow-hidden" : "flex flex-col gap-4 p-4 sm:p-6",
         className
      )}
   >
      <div
         className={cn(
            "flex min-w-0 flex-col items-start justify-between gap-4 @xl:flex-row @xl:items-center",
            flush && "border-b border-viewerborder px-4 pt-5 pb-4 sm:px-6"
         )}
      >
         <div className="flex min-w-0 flex-col gap-1 self-stretch @xl:flex-1 @xl:self-auto">
            {/* focusable so a flow can move focus here when the card's content changes */}
            <h2
               tabIndex={-1}
               className="text-base font-semibold text-viewerblack outline-none"
            >
               {title}
            </h2>
            {description && (
               <p className="min-w-0 text-sm break-words text-viewertext">
                  {description}
               </p>
            )}
         </div>
         {action}
      </div>
      {children}
   </section>
);

export default SettingsCard;
export { FORM_GRID };
