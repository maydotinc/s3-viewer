import useServers from "@/lib/hooks/queries/server/useServers";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { ServerIcon } from "lucide-react";

const ServerInfo = () => {
   const { currentServer, isServerListLoading, serverError } = useServers();

   if (isServerListLoading) {
      return (
         <div className="w-full hidden md:flex min-h-20 bg-viewerwhite justify-between px-8 py-4 items-center">
            <Skeleton className="w-20 h-10" />
            <Skeleton className="w-20 h-10" />
         </div>
      );
   }

   if (serverError || !currentServer) return null;

   return (
      <div className="w-full hidden sm:flex max-h-20 bg-viewerwhite px-8 py-4 items-center">
         <div className="flex gap-2 items-center">
            <div className="bg-viewerwhite border border-xs rounded-lg p-2">
               <ServerIcon className="text-viewerblack" />
            </div>
            <div className="flex flex-col items-start justify-between">
               <span className="text-viewertext text-sm leading-none">
                  Provider
               </span>
               <span className="text-viewerblack text-xl font-semibold leading-none max-w-[250px] truncate">
                  {currentServer?.name}
               </span>
            </div>
         </div>
      </div>
   );
};

export default ServerInfo;
