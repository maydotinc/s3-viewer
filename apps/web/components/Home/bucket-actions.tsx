import { useModalContext } from "@/lib/contexts/ModalContext";
import { Button } from "@s3-viewer/ui/components/button";
import { CodeXml, Plus, UserRoundPlus } from "lucide-react";

const BucketActions = () => {
   const { openShareModal, openCreateBucketModal } = useModalContext();

   return (
      <div className="flex gap-2 justify-end">
         <Button onClick={() => openShareModal({})} className="flex-initial">
            <UserRoundPlus className="size-4" />
            Share
         </Button>
         <Button className="flex-initial">
            <CodeXml className="size-4" />
            API
         </Button>
         <Button
            variant="secondary"
            onClick={() => openCreateBucketModal({})}
            className="flex-initial"
         >
            <Plus className="size-4" />
            Create Bucket
         </Button>
      </div>
   );
};

export default BucketActions;
