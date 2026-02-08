import { useModalContext } from "@/lib/contexts/ModalContext";
import { authClient } from "@s3-viewer/auth/client";
import { Button } from "@s3-viewer/ui/components/button";
import { Plus, UserRoundPlus } from "lucide-react";

const BucketActions = () => {
   const { openShareModal, openCreateBucketModal } = useModalContext();
   const { data: session } = authClient.useSession();

   if (!session) return null;

   return (
      <div className="flex gap-2 justify-end @max-2xl/actions:flex-1">
         <Button
            onClick={() => openShareModal({})}
            className="flex-initial @max-2xl/actions:flex-1"
         >
            <UserRoundPlus className="size-4" />
            Share
         </Button>
         <Button
            variant="secondary"
            onClick={() => openCreateBucketModal({})}
            className="flex-initial @max-2xl/actions:flex-1"
         >
            <Plus className="size-4" />
            Create Bucket
         </Button>
      </div>
   );
};

export default BucketActions;
