import useServers from "@/lib/hooks/queries/useServers";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { ServerIcon } from "lucide-react";

const ServerInfo = () => {
   const { currentServer } = useServers();

   if (!currentServer) {
      return (
         <div className="w-full hidden sm:flex min-h-20 bg-viewerwhite justify-between px-8 py-4 items-center">
            <Skeleton className="w-20 h-10" />
            <Skeleton className="w-20 h-10" />
         </div>
      );
   }

   return (
      <div className="w-full hidden sm:flex max-h-20 bg-viewerwhite justify-between px-8 py-4 items-center">
         <div className="flex gap-2 items-center">
            <div className="bg-viewerwhite border border-xs rounded-lg p-2">
               <ServerIcon className="text-viewerblack" />
            </div>
            <div className="flex flex-col items-start justify-between">
               <span className="text-viewertext text-sm leading-none">
                  Provider
               </span>
               <span className="text-viewerblack text-xl font-semibold leading-none">
                  {currentServer?.name}
               </span>
            </div>
         </div>
         <div className="flex flex-col justify-end">
            <span className="text-viewertext text-sm">Total Storage</span>
            <span className="text-viewerblack text-xl font-semibold">
               {currentServer?.storageUsed} T
            </span>
         </div>
      </div>
   );
};

export default ServerInfo;
