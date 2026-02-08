import type { ServerInfo } from "@s3-viewer/types";
import { Provider } from "@s3-viewer/types";
import { UserIcon } from "lucide-react";
import { useEffect } from "react";
import ServerLogo from "../../Layout/Sidebar/Servers/server-logo";
import useServers from "@/lib/hooks/queries/server/useServers";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";

const VALUE_MIN_WIDTH = "6rem"; /* ~96px, fits "Cloudflare" / "Unknown" */

const ServerInfo = () => {
   const {
      currentServer: server,
      isLoading,
      serverError,
   } = useServers();

   useEffect(() => {
      if (serverError) {
         console.error("[ServerInfo] Failed to load servers:", serverError);
      }
   }, [serverError]);

   const providerLabel = (() => {
      if (!server) return "Unknown";
      if (server.provider === Provider.S3) return "AWS";
      if (server.provider === Provider.R2) return "Cloudflare";
      return "Other";
   })();

   const roleLabel = (() => {
      if (server?.userRole)
         return (
            server.userRole.charAt(0) + server.userRole.toLowerCase().slice(1)
         );
      return "Unknown";
   })();

   if (isLoading) {
      return (
         <div className="flex flex-none gap-2 h-fit">
            <Skeleton className="h-14 w-[160px] rounded-xl shrink-0" />
            <Skeleton className="h-14 w-[160px] rounded-xl shrink-0" />
         </div>
      );
   }

   return (
      <div className="flex flex-none gap-2 h-fit">
         <div className="flex gap-2 border border-viewerborder rounded-xl p-2 items-center min-w-[160px]">
            <ServerLogo provider={server?.provider} />
            <div className="flex flex-col items-start gap-1 min-w-0 flex-1">
               <span className="text-viewertext text-xs leading-none">
                  Provider
               </span>
               <span
                  className="text-viewerblack text-md font-semibold leading-none max-w-[150px] truncate"
                  style={{ minWidth: VALUE_MIN_WIDTH }}
               >
                  {serverError ? (
                     <span className="text-viewertext">Error</span>
                  ) : (
                     providerLabel
                  )}
               </span>
            </div>
         </div>

         <div className="flex gap-2 items-center border border-viewerborder rounded-xl p-2 min-w-[160px]">
            <div className="bg-viewerblue/5 rounded-lg p-2 flex-none">
               <UserIcon className="size-5 text-viewerblue" />
            </div>
            <div className="flex flex-col items-start gap-1 min-w-0 flex-1">
               <span className="text-viewertext text-xs leading-none">
                  Role
               </span>
               <span
                  className="text-viewerblack text-md font-semibold leading-none max-w-[150px] truncate"
                  style={{ minWidth: VALUE_MIN_WIDTH }}
               >
                  {serverError ? (
                     <span className="text-viewertext">Error</span>
                  ) : (
                     roleLabel
                  )}
               </span>
            </div>
         </div>
      </div>
   );
};

export default ServerInfo;
