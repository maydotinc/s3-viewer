import { cn } from "@s3-viewer/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * The content column of every app page (DESIGN.md §2). It is the scroll
 * container as well as the measure: `main` never scrolls, this does, so a
 * table card can still take the remaining height with `min-h-0 flex-1`.
 */
const Page = ({
   className,
   children,
}: {
   className?: string;
   children: ReactNode;
}) => (
   <div
      className={cn(
         "mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col gap-6 overflow-y-auto px-8 py-6",
         className
      )}
   >
      {children}
   </div>
);

type PageHeaderProps = {
   /** Page title. Omit and pass `children` for a breadcrumb instead. */
   title?: ReactNode;
   description?: ReactNode;
   /** Right cluster: buttons, chips, menus. */
   actions?: ReactNode;
   /** Custom left content (a breadcrumb), used instead of `title`. */
   children?: ReactNode;
   className?: string;
};

/**
 * One row: title or breadcrumb on the left, actions on the right. `min-h-9`
 * keeps the row the height of a button even when the right side is empty, so
 * pages with and without actions line up.
 */
const PageHeader = ({
   title,
   description,
   actions,
   children,
   className,
}: PageHeaderProps) => (
   <div
      className={cn(
         // Wraps rather than crushing the title: below ~640px the actions
         // drop to their own line instead of squeezing the heading to "Buck…".
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
