import Pagination from "@/components/DataGrid/Actions/pagination";
import PrefixSearch from "@/components/DataGrid/Actions/prefix-search";

const GridActions = () => {
   return (
      <div className="flex gap-2 @max-3xl/actions:flex-1">
         <PrefixSearch className="@max-3xl/actions:flex-2" />
         <Pagination className="@max-3xl/actions:flex-1" />
      </div>
   );
};

export default GridActions;
