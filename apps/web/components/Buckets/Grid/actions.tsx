import Filter from "@/components/DataGrid/Actions/filter";
import Pagination from "@/components/DataGrid/Actions/pagination";
import PrefixSearch from "@/components/DataGrid/Actions/prefix-search";

const GridActions = () => {
   return (
      <div className="flex gap-2">
         <PrefixSearch />
         <Filter />
         <Pagination />
      </div>
   );
};

export default GridActions;
