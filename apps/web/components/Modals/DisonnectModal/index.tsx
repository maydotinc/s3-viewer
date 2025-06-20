import { useServerOperations } from "@/lib/hooks/useServer";
import { ServerInfo } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import {
   Dialog,
   DialogClose,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from "@s3-viewer/ui/components/dialog";
import { WifiOff } from "lucide-react";
import { useState } from "react";

type DisconnectModalProps = {
   onClose: () => void;
   server: ServerInfo;
};

const DisconnectModal: React.FC<DisconnectModalProps> = ({ onClose, server }) => {
   const { deleteServer } = useServerOperations();
   const [disconnectError, setDisconnectError] = useState<string | null>(null);
   const [loading, setLoading] = useState(false);

   const handleDisconnect = async () => {
      setLoading(true);
      try {
         const { success, message } = await deleteServer(server.id);
         if (!success) {
            setDisconnectError(message);
            setLoading(false);
            return;
         }
         setDisconnectError(null);
         onClose();
      } catch (e) {
         console.error(e);
         setDisconnectError("Failed to disconnect server");
         setLoading(false);
      }
   };

   return (
      <Dialog open={true} onOpenChange={onClose}>
         <DialogContent className="max-w-[95%] xs:max-w-lg sm:max-w-md overflow-hidden">
            <DialogHeader className="flex flex-col items-center text-center gap-2">
               <DialogTitle>
                  <div className="flex flex-col gap-5 items-center">
                     <div className="bg-viewergray border border-xs rounded-2xl p-4">
                        <WifiOff className="size-7 text-viewerblue" />
                     </div>
                     <span>Disconnect Server</span>
                  </div>
               </DialogTitle>
               <DialogDescription className="flex items-center text-center gap-2 flex-col">
                  <span>
                     Are you sure you want to disconnect this server? You will need to reconnect the
                     server manually to use it again.
                  </span>
               </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col justify-center gap-2">
               <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleDisconnect}
                  disabled={loading}
               >
                  {loading ? "Disconnecting..." : "Disconnect"}
               </Button>
               <DialogClose asChild>
                  <Button variant="outline" className="w-full">
                     Cancel
                  </Button>
               </DialogClose>
            </DialogFooter>
            {disconnectError && (
               <span className="text-red-500 text-sm text-center">{disconnectError}</span>
            )}
         </DialogContent>
      </Dialog>
   );
};

export default DisconnectModal;
