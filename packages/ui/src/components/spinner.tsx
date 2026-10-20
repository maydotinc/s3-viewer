import { cn } from "@s3-viewer/ui/lib/utils";

type SpinnerSize = "xs" | "sm";

type SpinnerProps = {
   size?: SpinnerSize;
   className?: string;
   label?: string;
};

const SIZE_CLASS: Record<SpinnerSize, string> = {
   xs: "size-3.5 border-[1.5px]",
   sm: "size-4 border-2",
};

const Spinner = ({
   size = "sm",
   className,
   label = "Loading…",
}: SpinnerProps) => (
   <span
      role="status"
      aria-label={label}
      className={cn(
         "inline-block shrink-0 animate-spin rounded-full border-viewerblue border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]",
         SIZE_CLASS[size],
         className
      )}
   />
);

export { Spinner };
