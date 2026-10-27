import useMinimumActive from "@/lib/hooks/useMinimumActive";
import { cn } from "@s3-viewer/ui/lib/utils";
import { RefreshCw } from "lucide-react";

const RefreshIcon = ({ spinning }: { spinning: boolean }) => {
   const spin = useMinimumActive(spinning);
   return (
      <RefreshCw
         aria-hidden="true"
         className={cn(spin && "animate-spin motion-reduce:animate-none")}
      />
   );
};

export default RefreshIcon;
