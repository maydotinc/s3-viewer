import { useState } from "react";
import { WifiOff } from "lucide-react";
import {
   Dialog,
   DialogClose,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from "@s3-viewer/ui/components/dialog";
import { Button } from "@s3-viewer/ui/components/button";
import { Role, ServerInfo } from "@s3-viewer/types";
import useServers from "@/lib/hooks/queries/server/useServers";
import useDisconnectServer from "@/lib/hooks/mutations/server/useDisconnectServer";
import useDeleteServer from "@/lib/hooks/mutations/server/useDeleteServer";

type DisconnectModalProps = {
   onClose: () => void;
   server: ServerInfo;
};

const DisconnectModal: React.FC<DisconnectModalProps> = ({
   onClose,
   server,
}) => {
   const deleteServerMutation = useDeleteServer();
   const disconnectServerMutation = useDisconnectServer();
   const [disconnectError, setDisconnectError] = useState<string | null>(null);
   const { currentServer } = useServers(server.id);

   const isOwner = currentServer?.userRole === Role.OWNER;
   const activeMutation = isOwner
      ? deleteServerMutation
      : disconnectServerMutation;

   const handleDisconnect = () => {
      activeMutation.mutate(
         { serverId: server.id },
         {
            onSuccess: () => {
               setDisconnectError(null);
               onClose();
            },
            onError: (error: Error) => {
               setDisconnectError(error.message);
            },
         }
      );
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
                     <span>
                        {isOwner ? "Remove Server" : "Disconnect Server"}
                     </span>
                  </div>
               </DialogTitle>
               <DialogDescription className="flex items-center text-center gap-2 flex-col">
                  <span>
                     {isOwner
                        ? "Are you sure you want to remove this server? This will permanently remove the server and remove all associated invites."
                        : "Are you sure you want to disconnect this server? You will need to be re-invited to access it again."}
                  </span>
               </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col justify-center gap-2">
               <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleDisconnect}
                  disabled={activeMutation.isPending}
               >
                  {activeMutation.isPending
                     ? isOwner
                        ? "Removing..."
                        : "Disconnecting..."
                     : isOwner
                       ? "Remove Server"
                       : "Disconnect Server"}
               </Button>
               <DialogClose asChild>
                  <Button variant="outline" className="w-full">
                     Cancel
                  </Button>
               </DialogClose>
            </DialogFooter>
            {disconnectError && (
               <span className="text-red-500 text-sm text-center">
                  {disconnectError}
               </span>
            )}
         </DialogContent>
      </Dialog>
   );
};

export default DisconnectModal;
