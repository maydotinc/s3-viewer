import { cn } from "@s3-viewer/ui/lib/utils";
import { ReactNode } from "react";

type CardProps = {
   title: string;
   description?: string;
   /** Right-aligned control in the card header. */
   action?: ReactNode;
   /**
    * Render children flush against the card edges (tables), instead of inside
    * the standard `p-6` body.
    */
   flush?: boolean;
   className?: string;
   children: ReactNode;
};

/** Page section card: DESIGN.md §4 (`rounded-xl border p-6`, `gap-4` inside). */
const Card = ({
   title,
   description,
   action,
   flush,
   className,
   children,
}: CardProps) => (
   <section
      className={cn(
         "flex min-w-0 shrink-0 flex-col overflow-hidden rounded-xl border border-viewerborder bg-viewerwhite",
         className
      )}
   >
      <header className="flex min-w-0 items-start justify-between gap-4 px-6 pt-5 pb-4">
         <div className="flex min-w-0 flex-col gap-1">
            <h2 className="min-w-0 truncate text-base font-semibold text-viewerblack">
               {title}
            </h2>
            {description && (
               <p className="text-sm text-viewertext">{description}</p>
            )}
         </div>
         {action}
      </header>
      {flush ? (
         children
      ) : (
         <div className="flex min-w-0 flex-col gap-4 px-6 pb-6">{children}</div>
      )}
   </section>
);

export default Card;
