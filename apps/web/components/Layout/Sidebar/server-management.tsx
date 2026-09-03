import { useModalContext } from "@/lib/contexts/ModalContext";
import { usePermission } from "@/lib/hooks/usePermission";
import { Permission } from "@s3-viewer/permissions";
import { Button } from "@s3-viewer/ui/components/button";
import { Plus } from "lucide-react";
import BucketList from "./Buckets";
import ServerSelector from "./Servers/server-select";

const ServerManagement = () => {
   const { openCreateBucketModal } = useModalContext();
   const canCreateBucket = usePermission(Permission.CREATE_BUCKET);

   return (
      <div className="flex h-full flex-col gap-3 rounded-xl border border-viewerborder p-2">
         <div className="flex flex-col gap-2">
            <span className="text-meta">Servers</span>
            <ServerSelector />
         </div>
         <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex h-6 items-center justify-between">
               <span className="text-meta">Buckets</span>
               {canCreateBucket && (
                  <Button
                     variant="ghost"
                     size="icon"
                     className="size-6"
                     aria-label="Create bucket"
                     onClick={() => openCreateBucketModal({})}
                  >
                     <Plus aria-hidden="true" className="size-3.5" />
                  </Button>
               )}
            </div>
            <BucketList />
         </div>
      </div>
   );
};

export default ServerManagement;
