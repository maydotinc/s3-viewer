import { cn } from "@s3-viewer/ui/lib/utils";
import { ReactNode } from "react";

type BasicBlockProps = {
   children: ReactNode;
   className?: string;
};

const BasicBlock = ({ children, className }: BasicBlockProps) => {
   return (
      <div
         className={cn(
            "w-full px-30 py-15 flex flex-col gap-6 max-xl:px-15 max-md:px-4 max-md:py-8",
            className
         )}
      >
         {children}
      </div>
   );
};

export default BasicBlock;
