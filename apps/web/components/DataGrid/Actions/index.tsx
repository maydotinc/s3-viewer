import { cn } from "@s3-viewer/ui/lib/utils";
import Filter from "./filter";
import Pagination from "./pagination";
import Search from "./search";

type GridActionsProps = {
   className?: string;
};

const GridActions = ({ className }: GridActionsProps) => {
   return (
      <div className={cn("flex gap-2", className)}>
         <Search className="flex-2/3" />
         <Filter className="flex-1/3" />
         <Pagination className="flex-1/3" />
      </div>
   );
};

export default GridActions;
