import { ServerInfo } from "@s3-viewer/types";
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from "@s3-viewer/ui/components/dialog";
import { FolderPen } from "lucide-react";
import { useState } from "react";
import SubmitButton from "./buttons/submit";
import NameInput from "./fields/name-input";

type RenameModalProps = {
   server: ServerInfo;
   onClose: () => void;
};

const RenameModal: React.FC<RenameModalProps> = ({ server, onClose }) => {
   const [serverName, setServerName] = useState(server.name);
   const [error, setError] = useState<string | null>(null);

   return (
      <Dialog open={true} onOpenChange={onClose}>
         <DialogContent className="max-w-[95%] xs:max-w-lg sm:max-w-md overflow-hidden">
            <DialogHeader className="flex flex-col items-center text-center gap-2">
               <DialogTitle>
                  <div className="flex flex-col gap-5 items-center">
                     <div className="bg-viewergray border border-xs rounded-2xl p-4">
                        <FolderPen className="size-7 text-viewerblue" />
                     </div>
                     <span>Rename Server</span>
                  </div>
               </DialogTitle>
               <DialogDescription className="flex items-center text-center gap-2 flex-col">
                  <span>Enter new name to rename the server. This only affects the name displayed in s3-viewer.</span>
               </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
               <NameInput
                  serverName={serverName}
                  setServerName={setServerName}
                  setError={setError}
               />
            </div>
            <DialogFooter className="flex flex-col justify-center">
               <SubmitButton
                  serverId={server.id}
                  serverName={serverName}
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

export default RenameModal;
