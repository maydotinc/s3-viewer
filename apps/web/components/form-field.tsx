import { Label } from "@s3-viewer/ui/components/label";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { cn } from "@s3-viewer/ui/lib/utils";
import type { ReactNode } from "react";

type FieldProps = {
   label: ReactNode;
   htmlFor?: string;
   trailing?: ReactNode;
   className?: string;
   children: ReactNode;
};

const Field = ({
   label,
   htmlFor,
   trailing,
   className,
   children,
}: FieldProps) => (
   <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {trailing ? (
         <div className="flex items-center justify-between gap-3">
            <Label htmlFor={htmlFor}>{label}</Label>
            {trailing}
         </div>
      ) : (
         <Label htmlFor={htmlFor}>{label}</Label>
      )}
      {children}
   </div>
);

type FieldSkeletonProps = {
   hint?: boolean;
   className?: string;
   children?: ReactNode;
};

// mirrors a gap-2 Field around an input or select trigger; the hint line is FormError's xs text
const FieldSkeleton = ({
   hint = false,
   className,
   children,
}: FieldSkeletonProps) => (
   <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <Skeleton className="h-3.5 w-28" />
      <Skeleton className="h-9 rounded-lg pointer-coarse:h-11" />
      {hint && (
         <div className="flex h-5 items-center">
            <Skeleton className="h-3 w-36" />
         </div>
      )}
      {children}
   </div>
);

// a hint's real wording behind a pulse, so the skeleton wraps onto as many lines as the hint at any width
const HintSkeleton = ({ children }: { children: string }) => (
   <p aria-hidden="true" className="text-xs text-transparent select-none">
      <span className="animate-pulse rounded bg-viewergray box-decoration-clone">
         {children}
      </span>
   </p>
);

export default Field;
export { FieldSkeleton, HintSkeleton };
