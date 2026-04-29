import { cn } from "@s3-viewer/ui/lib/utils";
import type { ReactNode, SVGAttributes } from "react";

export const IllustrationFrame = ({
   children,
   className,
}: {
   children: ReactNode;
   className?: string;
}) => (
   <div
      className={cn(
         "relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-viewerborder bg-viewergray",
         className
      )}
   >
      <div className="absolute inset-0 grid place-items-center p-8 sm:p-12">
         {children}
      </div>
   </div>
);

export const SVGRoot = ({
   children,
   viewBox = "0 0 480 360",
   className,
   ...rest
}: {
   children: ReactNode;
   viewBox?: string;
   className?: string;
} & SVGAttributes<SVGSVGElement>) => (
   <svg
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
         "relative size-full max-h-full max-w-full text-viewerblue",
         className
      )}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-hidden
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
   >
      {children}
   </svg>
);
