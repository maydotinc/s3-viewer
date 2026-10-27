import { cn } from "@s3-viewer/ui/lib/utils";
import type { ComponentType, ReactNode } from "react";

export type IconComponent = ComponentType<{
   className?: string;
   strokeWidth?: number;
}>;

export const IconBadge = ({
   icon: Icon,
   iconClassName,
}: {
   icon: IconComponent;
   iconClassName: string;
}) => (
   <span className="grid size-10 place-items-center rounded-lg bg-viewergray text-viewerblue">
      <Icon className={iconClassName} strokeWidth={1.8} />
   </span>
);

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
      <IconBadge icon={Icon} iconClassName="size-4.5" />
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
