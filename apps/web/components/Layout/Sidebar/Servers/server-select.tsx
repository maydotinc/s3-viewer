import { useModalContext } from "@/lib/contexts/ModalContext";
import useServers from "@/lib/hooks/queries/server/useServers";
import useSessionStore, { useUserId } from "@/lib/stores/sessionStore";
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
import { CirclePlus } from "lucide-react";
import ServerCard, { SERVER_CARD, ServerCardLoading } from "./server-card";
import ServerItem from "./server-item";

const ServerSelector = () => {
   const { openConnectModal } = useModalContext();
   const { servers, currentServer, isServerListLoading, serverError } =
      useServers();
   const setServerId = useSessionStore((state) => state.setServerId);
   const userId = useUserId();

   if (!userId || isServerListLoading) return <ServerCardLoading />;

   if (serverError) {
      return (
         <p
            role="alert"
            className={`${SERVER_CARD} fade-in items-center justify-center text-center text-sm text-viewertextred`}
         >
            {serverError.message}
         </p>
      );
   }

   if (!currentServer) {
      return (
         <div className={`${SERVER_CARD} fade-in`}>
            <p className="text-center text-sm leading-none text-viewertext">
               No servers yet
            </p>
            <Button
               variant="outline"
               className="w-full"
               onClick={openConnectModal}
            >
               <CirclePlus aria-hidden="true" />
               Add server
            </Button>
         </div>
      );
   }

   return (
      <DropdownMenu>
         <DropdownMenuTrigger
            aria-label="Switch server"
            className="w-full rounded-xl border border-transparent outline-none focus-visible:border-viewerblue"
         >
            <ServerCard server={currentServer} />
         </DropdownMenuTrigger>
         <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuRadioGroup
               value={currentServer.id}
               onValueChange={setServerId}
            >
               {servers.map((server) => (
                  <DropdownMenuRadioItem
                     key={server.id}
                     value={server.id}
                     textValue={server.name}
                     className="pl-1 pr-1"
                  >
                     <ServerItem
                        server={server}
                        selected={server.id === currentServer.id}
                     />
                  </DropdownMenuRadioItem>
               ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={openConnectModal}>
               <CirclePlus aria-hidden="true" />
               Add server
            </DropdownMenuItem>
         </DropdownMenuContent>
      </DropdownMenu>
   );
};

export default ServerSelector;
