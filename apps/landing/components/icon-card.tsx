import { cn } from "@s3-viewer/ui/lib/utils";
import type { ComponentType, ReactNode } from "react";

export type IconComponent = ComponentType<{
   className?: string;
   strokeWidth?: number;
}>;

const IconCard = ({
   icon: Icon,
   title,
   children,
   className,
   titleClassName,
}: {
   icon: IconComponent;
   title: string;
   children: ReactNode;
   className?: string;
   titleClassName?: string;
}) => (
   <div
      className={cn(
         "flex flex-col gap-4 rounded-xl border border-viewerborder bg-viewerwhite p-6",
         className
      )}
   >
      <span className="grid place-items-center size-10 rounded-lg bg-viewergray text-viewerblue">
         <Icon className="size-4.5" strokeWidth={1.8} />
      </span>
      <h3
         className={cn(
            "text-base font-semibold text-viewerblack tracking-tight",
            titleClassName
         )}
      >
         {title}
      </h3>
      <p className="text-sm text-viewertext leading-relaxed">{children}</p>
   </div>
);

export default IconCard;
