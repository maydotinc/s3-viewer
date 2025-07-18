import Filter from "../DataGrid/Actions/filter";
import Pagination from "../DataGrid/Actions/pagination";
import QuickSearch from "../DataGrid/Actions/quick-search";

const GridActions = () => {
   return (
      <div className="flex gap-2">
         <QuickSearch />
         <Filter />
         <Pagination />
      </div>
   );
};

export default GridActions;
