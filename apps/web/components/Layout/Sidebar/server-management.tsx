import { useModalContext } from "@/lib/contexts/ModalContext";
import { usePermission } from "@/lib/hooks/usePermission";
import { Permission } from "@s3-viewer/permissions";
import { Button } from "@s3-viewer/ui/components/button";
import { Plus } from "lucide-react";
import BucketList from "./Buckets";
import ServerSelector from "./Servers/server-select";

const SECTION_LABEL =
   "px-2 text-[11px] font-medium tracking-wide text-viewerlighttext uppercase";

const ServerManagement = () => {
   const { openCreateBucketModal } = useModalContext();
   const canCreateBucket = usePermission(Permission.CREATE_BUCKET);

   return (
      <div className="flex h-full flex-col gap-6">
         <div className="flex flex-col gap-2">
            <span className={SECTION_LABEL}>Servers</span>
            <ServerSelector />
         </div>
         <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex h-8 items-center justify-between">
               <span className={SECTION_LABEL}>Buckets</span>
               {canCreateBucket && (
                  <Button
                     variant="ghost"
                     size="icon-sm"
                     aria-label="Create bucket"
                     onClick={() => openCreateBucketModal({})}
                  >
                     <Plus aria-hidden="true" />
                  </Button>
               )}
            </div>
            <BucketList />
         </div>
      </div>
   );
};

export default ServerManagement;
