import { authClient } from "@s3-viewer/auth/client";
import { useModalContext } from "@/lib/contexts/ModalContext";
import useServers from "@/lib/hooks/queries/server/useServers";
import useSessionStore from "@/lib/stores/sessionStore";
import { Button } from "@s3-viewer/ui/components/button";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import {
   DropdownMenu,
   DropdownMenuTrigger,
   DropdownMenuContent,
   DropdownMenuRadioGroup,
   DropdownMenuRadioItem,
   DropdownMenuItem,
   DropdownMenuSeparator,
} from "@s3-viewer/ui/components/dropdown-menu";
import { CirclePlus, ChevronsLeftRight } from "lucide-react";
import ServerCard from "./server-card";
import ServerItem from "./server-item";

const ServerSelector = () => {
   const { openConnectModal } = useModalContext();
   const { servers, currentServer, isLoading, serverError } = useServers();
   const setServerId = useSessionStore((state) => state.setServerId);
   const { data: session, isPending } = authClient.useSession();

   const handleServerSelect = (newServerId: string) => {
      setServerId(newServerId);
   };

   if (isLoading || (!session && !isPending)) {
      return (
         <div
            className="flex flex-col gap-2 bg-viewergray rounded-xl w-full border-none p-2 min-h-[74px]"
            aria-hidden
         >
            <div className="flex gap-2 items-center">
               <div className="bg-viewerwhite border border-xs rounded-sm p-1 flex-none">
                  <Skeleton className="size-4 rounded bg-transparent" />
               </div>
               <div className="md:max-w-[100px] min-w-0">
                  <Skeleton className="h-5 w-[100px] rounded" />
               </div>
               <div className="flex gap-2 items-center ml-auto border border-viewerborder rounded-full p-1.5 bg-viewerwhite">
                  <ChevronsLeftRight className="size-4 rotate-90 text-viewertext" />
               </div>
            </div>
            <div className="flex gap-2 items-center text-viewertext">
               <Skeleton className="size-4 shrink-0 rounded" />
               <Skeleton className="h-5 w-14 rounded" />
            </div>
         </div>
      );
   }

   if (serverError) {
      return (
         <div className="flex flex-col gap-2 bg-viewergray rounded-xl w-full border-none p-2">
            <p className="text-viewertext text-center">Error loading servers</p>
         </div>
      );
   }

   if (servers.length === 0 || !currentServer) {
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
         <DropdownMenuTrigger className="select-none rounded-xl focus:outline-none focus:ring-0">
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
