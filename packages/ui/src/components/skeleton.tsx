import { cn } from "@s3-viewer/ui/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
   return (
      <div
         className={cn("animate-pulse rounded-md bg-viewergray", className)}
         {...props}
      />
   );
}

export { Skeleton };
