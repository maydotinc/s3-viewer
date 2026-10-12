import { cn } from "@s3-viewer/ui/lib/utils";
import type { ReactNode } from "react";

type SectionLabelProps = {
   as?: "p" | "span" | "h3";
   className?: string;
   children: ReactNode;
};

const SectionLabel = ({
   as: Tag = "p",
   className,
   children,
}: SectionLabelProps) => (
   <Tag
      className={cn(
         "text-[11px] font-medium tracking-wide text-viewerlighttext uppercase",
         className
      )}
   >
      {children}
   </Tag>
);

export default SectionLabel;
