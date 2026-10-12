import ListPagination from "@/components/list-pagination";
import useServers from "@/lib/hooks/queries/server/useServers";

const ServerListPagination = () => {
   const query = useServers();
   return (
      <ListPagination
         {...query}
         error={query.serverListError}
         label="Load more servers"
      />
   );
};

export default ServerListPagination;
