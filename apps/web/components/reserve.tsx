import { cn } from "@s3-viewer/ui/lib/utils";
import type { ReactNode } from "react";

type ReserveProps = {
   show: boolean;
   as?: "span" | "div";
   className?: string;
   children: ReactNode;
};

// keeps hidden content in the layout so it can appear without shifting anything around it
const Reserve = ({
   show,
   as: Tag = "span",
   className,
   children,
}: ReserveProps) => (
   <Tag
      aria-hidden={show ? undefined : true}
      inert={!show}
      className={cn(className, !show && "invisible")}
   >
      {children}
   </Tag>
);

export default Reserve;
