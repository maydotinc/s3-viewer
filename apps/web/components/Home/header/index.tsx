import useServers from "@/lib/hooks/queries/server/useServers";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import ServerInfo from "./server-info";

const ServerHeader = () => {
   const { currentServer, isServerListLoading, serverError } = useServers();

   if (isServerListLoading || !currentServer) {
      return (
         <div className="w-full hidden md:flex min-h-[var(--header-height)] bg-viewerwhite justify-between px-8 py-4 items-center">
            <Skeleton className="w-20 h-10" />
            <Skeleton className="w-20 h-10" />
         </div>
      );
   }

   if (serverError) {
      console.error("Error fetching server info", serverError);
      return null;
   }

   return (
      <div className="w-full box-border border-b flex border-viewerborder bg-viewerwhite px-8 py-4 gap-4 justify-between items-center min-h-[var(--header-height)]">
         <div className="flex flex-col max-md:hidden">
            <span className="text-viewerblack text-lg font-semibold leading-none">
               Buckets Overview
            </span>
            <span className="text-viewertext text-md">
               Navigate through your buckets and view their contents
            </span>
         </div>
         <ServerInfo server={currentServer} />
      </div>
   );
};

export default ServerHeader;
