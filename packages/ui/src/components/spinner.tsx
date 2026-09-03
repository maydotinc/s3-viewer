import { cn } from "@s3-viewer/ui/lib/utils";

type SpinnerSize = "sm" | "md" | "lg";

type SpinnerProps = {
   size?: SpinnerSize;
   className?: string;
   label?: string;
};

const SIZE_CLASS: Record<SpinnerSize, string> = {
   sm: "size-4 border-2",
   md: "size-6 border-2",
   lg: "size-8 border-[3px]",
};

const Spinner = ({
   size = "md",
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
export type { SpinnerSize };
