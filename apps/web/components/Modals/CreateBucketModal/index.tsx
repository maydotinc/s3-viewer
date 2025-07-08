import useSessionStore from "@/lib/stores/sessionStore";
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from "@s3-viewer/ui/components/dialog";
import { FolderPlus } from "lucide-react";
import { useState } from "react";
import SubmitButton from "./buttons/submit";
import BucketNameInput from "./fields/bucket-name-input";

type CreateBucketModalProps = {
   serverId?: string;
   onClose: () => void;
};

const CreateBucketModal: React.FC<CreateBucketModalProps> = ({
   serverId,
   onClose,
}) => {
   const sessionServerId = useSessionStore((state) => state.serverId);
   const currentServerId = serverId || sessionServerId;

   const [bucketName, setBucketName] = useState("");
   const [error, setError] = useState<string | null>(null);

   return (
      <Dialog open={true} onOpenChange={onClose}>
         <DialogContent className="max-w-[95%] xs:max-w-lg sm:max-w-md overflow-hidden">
            <DialogHeader className="flex flex-col items-center text-center gap-2">
               <DialogTitle>
                  <div className="flex flex-col gap-5 items-center">
                     <div className="bg-viewergray border border-xs rounded-2xl p-4">
                        <FolderPlus className="size-7 text-viewerblue" />
                     </div>
                     <span>Create Bucket</span>
                  </div>
               </DialogTitle>
               <DialogDescription className="flex items-center text-center gap-2 flex-col">
                  <span>Enter a name for your new bucket</span>
               </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
               <BucketNameInput
                  bucketName={bucketName}
                  setBucketName={setBucketName}
                  setError={setError}
               />
            </div>
            <DialogFooter className="flex flex-col justify-center">
               <SubmitButton
                  serverId={currentServerId}
                  bucketName={bucketName}
                  error={error}
                  setError={setError}
                  onClose={onClose}
               />
            </DialogFooter>
            {error && <span className="text-red-500 text-sm">{error}</span>}
         </DialogContent>
      </Dialog>
   );
};

export default CreateBucketModal;
