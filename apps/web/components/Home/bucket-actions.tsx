import { useModalContext } from "@/lib/contexts/ModalContext";
import useServers from "@/lib/hooks/queries/server/useServers";
import { usePermission } from "@/lib/hooks/usePermission";
import { Permission } from "@s3-viewer/permissions";
import { Button } from "@s3-viewer/ui/components/button";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { Plus, UserRoundPlus } from "lucide-react";

const BucketActions = () => {
   const { openShareModal, openCreateBucketModal } = useModalContext();
   const { currentServer, isSessionPending, isServerListLoading } =
      useServers();
   const canShare = usePermission(Permission.MANAGE_MEMBERS);
   const canCreate = usePermission(Permission.CREATE_BUCKET);

   if (isSessionPending || isServerListLoading) {
      return (
         <div className="flex gap-2" aria-busy="true">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-32 rounded-lg" />
         </div>
      );
   }

   return (
      <div className="flex gap-2">
         {canShare && (
            <Button
               variant="outline"
               className="w-24"
               onClick={() =>
                  openShareModal({ server: currentServer ?? undefined })
               }
            >
               <UserRoundPlus aria-hidden="true" />
               Share
            </Button>
         )}
         {canCreate && (
            <Button className="w-32" onClick={() => openCreateBucketModal({})}>
               <Plus aria-hidden="true" />
               Create bucket
            </Button>
         )}
      </div>
   );
};

export default BucketActions;
