import { Label } from "@s3-viewer/ui/components/label";
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

export default Field;
