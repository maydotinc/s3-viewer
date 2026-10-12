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
         "flex min-h-0 min-w-0 w-full flex-1 flex-col gap-6 overflow-y-auto px-[max(1rem,calc((100%_-_1368px)/2))] py-6 [scrollbar-gutter:stable] md:px-[max(2rem,calc((100%_-_1336px)/2))]",
         className
      )}
   >
      {children}
   </div>
);

const PageTitle = ({
   title,
   children,
}: {
   title?: string;
   children: ReactNode;
}) => (
   <h1
      title={title}
      className="min-w-0 truncate text-xl font-semibold tracking-tight text-viewerblack"
   >
      {children}
   </h1>
);

type PageHeaderProps = {
   title?: string;
   actions?: ReactNode;
   children?: ReactNode;
   className?: string;
};

const PageHeader = ({
   title,
   actions,
   children,
   className,
}: PageHeaderProps) => (
   <div
      className={cn(
         "flex min-h-9 min-w-0 w-full shrink-0 flex-wrap items-center justify-between gap-4",
         className
      )}
   >
      <div className="flex min-w-0 flex-1 basis-full flex-col gap-1 sm:basis-64">
         {children ?? (title ? <PageTitle>{title}</PageTitle> : null)}
      </div>
      {actions && (
         <div className="-m-1 flex min-h-9 min-w-0 max-w-[calc(100%+0.5rem)] shrink-0 items-center gap-2 overflow-x-auto p-1 [&>*]:shrink-0">
            {actions}
         </div>
      )}
   </div>
);

export { Page, PageHeader, PageTitle };
