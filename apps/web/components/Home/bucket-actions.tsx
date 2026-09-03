import { useModalContext } from "@/lib/contexts/ModalContext";
import useServers from "@/lib/hooks/queries/server/useServers";
import { usePermission } from "@/lib/hooks/usePermission";
import { Permission } from "@s3-viewer/permissions";
import { Button } from "@s3-viewer/ui/components/button";
import { Spinner } from "@s3-viewer/ui/components/spinner";
import { Plus, UserRoundPlus } from "lucide-react";

const BucketActions = () => {
   const { openShareModal, openCreateBucketModal } = useModalContext();
   const { currentServer, isSessionPending, isServerListLoading } =
      useServers();
   const canShare = usePermission(Permission.MANAGE_MEMBERS);
   const canCreate = usePermission(Permission.CREATE_BUCKET);

   if (isSessionPending || isServerListLoading) {
      return (
         <div className="flex h-9 min-w-[232px] items-center justify-end">
            <Spinner size="sm" label="Loading actions" />
         </div>
      );
   }

   return (
      <div className="fade-in flex h-9 min-w-[232px] items-center justify-end gap-2">
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
