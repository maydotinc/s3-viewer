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
   DialogTrigger,
} from "@s3-viewer/ui/components/dialog";
import { Server, WifiOff } from "lucide-react";
import { useState } from "react";

type ServerDisconnectProps = {
   server: ServerInfo;
};

const ServerDisconnect = ({ server }: ServerDisconnectProps) => {
   const [isOpen, setIsOpen] = useState(false);
   const { deleteServer } = useServerOperations();
   const [disconnectError, setDisconnectError] = useState<string | null>(null);

   const handleDisconnect = async () => {
      try {
         const { success, message } = await deleteServer(server.id);
         if (!success) {
            setDisconnectError(message);
            return;
         }
         setDisconnectError(null);
         setIsOpen(false);
      } catch (e) {
         console.error(e);
         setDisconnectError("Failed to disconnect server");
      }
   };

   return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
         <DialogTrigger className="w-full">
            <div className="flex items-center gap-2 cursor-pointer size-full">
               <WifiOff className="size-4 text-viewertextred" />
               Disconnect Server
            </div>
         </DialogTrigger>
         <DialogContent>
            <DialogHeader className="flex flex-col gap-2 items-center text-center">
               <div className="bg-viewergray border border-viewerborder rounded-2xl p-3 mb-2">
                  <Server className="size-10 text-viewerblue" />
               </div>
               <DialogTitle>Disconnect Server</DialogTitle>
               <DialogDescription>
                  Are you sure you want to disconnect this server? You will need to reconnect the
                  server manually to use it again.
               </DialogDescription>
            </DialogHeader>
            <DialogFooter>
               <DialogClose asChild>
                  <Button variant="outline" className="flex-1">
                     Cancel
                  </Button>
               </DialogClose>
               <Button variant="destructive" className="flex-1" onClick={handleDisconnect}>
                  Disconnect
               </Button>
            </DialogFooter>
            {disconnectError && (
               <p className="text-viewertextred text-sm text-center">{disconnectError}</p>
            )}
         </DialogContent>
      </Dialog>
   );
};

export default ServerDisconnect;
