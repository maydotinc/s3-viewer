import SectionLabel from "@/components/section-label";
import { useModalActions } from "@/lib/contexts/modal-context";
import { useCanCreateBucket } from "@/lib/hooks/usePermission";
import { Button } from "@s3-viewer/ui/components/button";
import { Plus } from "lucide-react";
import BucketList from "./Buckets";
import ServerSelect from "@/components/Layout/Sidebar/Servers/server-select";

const ServerManagement = () => {
   const { open } = useModalActions();
   const canCreateBucket = useCanCreateBucket();

   return (
      <div className="flex min-h-0 flex-1 flex-col gap-6">
         <div className="flex shrink-0 flex-col gap-2">
            <SectionLabel as="span" className="px-2">
               Servers
            </SectionLabel>
            <ServerSelect />
         </div>
         <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex h-8 shrink-0 items-center justify-between">
               <SectionLabel as="span" className="px-2">
                  Buckets
               </SectionLabel>
               {canCreateBucket && (
                  <Button
                     variant="ghost"
                     size="icon-sm"
                     aria-label="Create bucket"
                     onClick={() => open("createBucket", {})}
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
