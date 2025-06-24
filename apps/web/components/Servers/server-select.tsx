import { useModalContext } from "@/lib/contexts/ModalContext";
import useServers from "@/lib/hooks/useServers";
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
import { useRouter } from "next/router";
import ServerCard from "./server-card";
import ServerItem from "./server-item";

const ServerSelector = () => {
   const router = useRouter();
   const { openConnectModal } = useModalContext();
   const {
      servers,
      currentServer,
      currentServerId,
      selectServer,
      isServerListLoading,
      serverError,
   } = useServers();

   const handleServerSelect = (newServerId: string) => {
      selectServer(newServerId);
      if (router.pathname.includes("/buckets/")) {
         router.push("/home");
      }
   };

   if (isServerListLoading || !servers) {
      return <Skeleton className="bg-viewergray rounded-md w-full border-none h-10" />;
   }

   if (serverError) {
      return <p>Error loading servers</p>;
   }

   if (!servers || servers.length === 0) {
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

   const selectedServer = currentServer || servers[0];

   return (
      <DropdownMenu>
         <DropdownMenuTrigger className="select-none">
            <ServerCard server={selectedServer} />
         </DropdownMenuTrigger>
         <DropdownMenuContent className="select-none">
            <DropdownMenuRadioGroup value={currentServerId} onValueChange={handleServerSelect}>
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
            <DropdownMenuItem className="py-2 text-viewerblack" onClick={() => openConnectModal()}>
               <CirclePlus className="size-5" />
               Add new server
            </DropdownMenuItem>
         </DropdownMenuContent>
      </DropdownMenu>
   );
};

export default ServerSelector;
