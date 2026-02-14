import ServerSelector from "@/components/Layout/Sidebar/Servers/server-select";
import { useModalContext } from "@/lib/contexts/ModalContext";
import useServers from "@/lib/hooks/queries/server/useServers";
import { hasPermissions, Permission } from "@s3-viewer/permissions";
import { Plus } from "lucide-react";
import BucketList from "./Buckets";

const ServerManagement = () => {
   const { openCreateBucketModal } = useModalContext();
   const { currentServer } = useServers();
   const canCreateBucket =
      currentServer?.userRole &&
      hasPermissions(currentServer.userRole, [Permission.CREATE_BUCKET]);

   return (
      <div className="flex flex-col flex-1 rounded-xl max-h-full border border-viewerborder px-2 pt-2 pb-0 gap-3">
         <div className="flex flex-col gap-3">
            <span className="text-xs text-viewerlighttext">SERVERS</span>
            <ServerSelector />
         </div>
         <div className="flex flex-col overflow-auto gap-3">
            <div className="flex items-center justify-between">
               <span className="text-xs text-viewerlighttext">BUCKETS</span>
               {canCreateBucket && (
                  <button
                     onClick={() => openCreateBucketModal({})}
                     title="Create bucket"
                     className="p-0.5 rounded hover:bg-viewergray transition-colors"
                  >
                     <Plus className="size-3.5 text-viewerlighttext hover:text-viewerblue" />
                  </button>
               )}
            </div>
            <BucketList />
         </div>
      </div>
   );
};

export default ServerManagement;
