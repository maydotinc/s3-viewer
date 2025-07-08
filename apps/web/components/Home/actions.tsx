import { useModalContext } from "@/lib/contexts/ModalContext";
import { Button } from "@s3-viewer/ui/components/button";
import { CodeXml, Plus, UserRoundPlus } from "lucide-react";

const BucketActions = () => {
   const { openShareModal, openCreateBucketModal } = useModalContext();

   return (
      <div className="flex gap-2">
         <Button onClick={() => openShareModal({})}>
            <UserRoundPlus className="size-4" />
            Share
         </Button>
         <Button>
            <CodeXml className="size-4" />
            API
         </Button>
         <Button variant="secondary" onClick={() => openCreateBucketModal({})}>
            <Plus className="size-4" />
            Create Bucket
         </Button>
      </div>
   );
};

export default BucketActions;
