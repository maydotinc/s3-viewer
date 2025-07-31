import { cn } from "@s3-viewer/ui/lib/utils";
import { ReactNode } from "react";

type BasicBlockProps = {
   children: ReactNode;
   className?: string;
   wrapperbg?: {
      className: string;
      component?: ReactNode;
   };
};

const BasicBlock = ({ children, className, wrapperbg }: BasicBlockProps) => {
   return (
      <div
         className={cn(
            "flex w-full items-center justify-center",
            wrapperbg?.className
         )}
      >
         {wrapperbg?.component && wrapperbg.component}
         <div
            className={cn(
               "w-full max-w-screen-2xl px-30 py-15 flex flex-col gap-6 max-xl:px-15 max-md:px-4 max-md:py-8",
               className
            )}
         >
            {children}
         </div>
      </div>
   );
};

export default BasicBlock;
