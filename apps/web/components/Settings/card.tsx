import { cn } from "@s3-viewer/ui/lib/utils";
import type { ReactNode } from "react";

type SettingsCardProps = {
   title: string;
   description?: string;
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
         "rounded-xl border border-viewerborder bg-viewerwhite",
         flush ? "overflow-hidden" : "flex flex-col gap-4 p-6",
         className
      )}
   >
      <div
         className={cn(
            "flex items-start justify-between gap-4",
            flush && "border-b border-viewerborder px-6 pt-5 pb-4"
         )}
      >
         <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-base font-semibold text-viewerblack">
               {title}
            </h2>
            {description && (
               <p className="text-sm text-viewertext">{description}</p>
            )}
         </div>
         {action}
      </div>
      {children}
   </section>
);

export default SettingsCard;
