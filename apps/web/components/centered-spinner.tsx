import { Spinner } from "@s3-viewer/ui/components/spinner";
import { cn } from "@s3-viewer/ui/lib/utils";
import type { ComponentProps, ReactNode } from "react";

type CenteredSpinnerProps = {
   label: string;
   size?: ComponentProps<typeof Spinner>["size"];
   className?: string;
   children?: ReactNode;
};

const CenteredSpinner = ({
   label,
   size,
   className = "min-h-0 flex-1",
   children,
}: CenteredSpinnerProps) => (
   <div className={cn("flex items-center justify-center", className)}>
      <Spinner size={size} label={label} />
      {children}
   </div>
);

export default CenteredSpinner;
