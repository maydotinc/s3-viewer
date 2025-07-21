import Filter from "../DataGrid/Actions/filter";
import Pagination from "../DataGrid/Actions/pagination";
import QuickSearch from "../DataGrid/Actions/quick-search";

const GridActions = () => {
   return (
      <div className="flex gap-2 @max-3xl/actions:flex-1">
         <QuickSearch className="@max-3xl/actions:flex-2" />
         <Filter className="@max-3xl/actions:flex-1" />
         <Pagination className="@max-3xl/actions:flex-1" />
      </div>
   );
};

export default GridActions;
