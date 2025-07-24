import { useModalContext } from "@/lib/contexts/ModalContext";
import useServers from "@/lib/hooks/queries/server/useServers";
import useSessionStore from "@/lib/stores/sessionStore";
import { authClient } from "@s3-viewer/auth/client";
import { Button } from "@s3-viewer/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuRadioGroup,
   DropdownMenuRadioItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { CirclePlus } from "lucide-react";
import ServerCard from "./server-card";
import ServerItem from "./server-item";

const ServerSelector = () => {
   const { openConnectModal } = useModalContext();
   const { servers, currentServer, isServerListLoading, serverError } =
      useServers();
   const setServerId = useSessionStore((state) => state.setServerId);
   const { data: session, isPending } = authClient.useSession();

   const handleServerSelect = (newServerId: string) => {
      setServerId(newServerId);
   };

   if (!session && !isPending) {
      return (
         <div className="flex flex-col gap-2 bg-viewergray rounded-xl w-full border-none p-2">
            <p className="text-viewertext text-center">
               Please login to connect a server
            </p>
         </div>
      );
   }

   if (isServerListLoading || !currentServer || isPending) {
      return (
         <Skeleton className="bg-viewergray rounded-md w-full border-none h-10" />
      );
   }

   if (serverError) {
      return (
         <div className="flex flex-col gap-2 bg-viewergray rounded-xl w-full border-none p-2">
            <p className="text-viewertext text-center">Error loading servers</p>
         </div>
      );
   }

   if (servers.length === 0) {
      return (
         <div className="flex flex-col gap-2 bg-viewergray rounded-xl w-full border-none p-2">
            <p className="text-viewertext text-center">No servers connected</p>
            <Button
               className="w-full cursor-pointer"
               variant="outline"
               onClick={() => openConnectModal()}
            >
               <CirclePlus className="size-5" />
               Add new server
            </Button>
         </div>
      );
   }

   return (
      <DropdownMenu>
         <DropdownMenuTrigger className="select-none">
            <ServerCard server={currentServer} />
         </DropdownMenuTrigger>
         <DropdownMenuContent className="select-none">
            <DropdownMenuRadioGroup
               value={currentServer.id}
               onValueChange={handleServerSelect}
            >
               {servers.map((server) => (
                  <DropdownMenuRadioItem
                     key={server.id}
                     value={server.id}
                     className="w-50 text-viewerblack"
                  >
                     <ServerItem server={server} />
                  </DropdownMenuRadioItem>
               ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator className="w-19/20 bg-viewerborder mx-auto" />
            <DropdownMenuItem
               className="py-2 text-viewerblack"
               onClick={() => openConnectModal()}
            >
               <CirclePlus className="size-5" />
               Add new server
            </DropdownMenuItem>
         </DropdownMenuContent>
      </DropdownMenu>
   );
};

export default ServerSelector;
