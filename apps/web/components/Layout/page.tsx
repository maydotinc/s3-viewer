import { cn } from "@s3-viewer/ui/lib/utils";
import type { ReactNode } from "react";

const Page = ({
   className,
   children,
}: {
   className?: string;
   children: ReactNode;
}) => (
   <div
      className={cn(
         "mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 md:px-8",
         className
      )}
   >
      {children}
   </div>
);

type PageHeaderProps = {
   title?: ReactNode;
   description?: ReactNode;
   actions?: ReactNode;
   children?: ReactNode;
   className?: string;
};

const PageHeader = ({
   title,
   description,
   actions,
   children,
   className,
}: PageHeaderProps) => (
   <div
      className={cn(
         "flex min-h-9 w-full shrink-0 flex-wrap items-center justify-between gap-4",
         className
      )}
   >
      <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
         {children ??
            (title ? (
               <h1 className="min-w-0 truncate text-xl font-semibold tracking-tight text-viewerblack">
                  {title}
               </h1>
            ) : null)}
         {description && (
            <p className="text-sm text-viewertext">{description}</p>
         )}
      </div>
      {actions && (
         <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
   </div>
);

export { Page, PageHeader };
