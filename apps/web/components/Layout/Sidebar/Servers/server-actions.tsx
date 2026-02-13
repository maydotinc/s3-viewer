import { useModalContext } from "@/lib/contexts/ModalContext";
import useServers from "@/lib/hooks/queries/server/useServers";
import { hasPermissions, Permission } from "@s3-viewer/permissions";
import { Role, ServerInfo } from "@s3-viewer/types";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import { cn } from "@s3-viewer/ui/lib/utils";
import { ChevronRight, PenLine, Share2, Trash2, WifiOff } from "lucide-react";
import { useState } from "react";

type ServerActionsProps = {
   server: ServerInfo;
};

const ServerActions = ({ server }: ServerActionsProps) => {
   const { currentServer } = useServers(server.id);
   const [isOpen, setIsOpen] = useState(false);
   const { openModal } = useModalContext();

   const userRole = currentServer?.userRole;
   const isOwner = userRole === Role.OWNER;

   return (
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
         <DropdownMenuTrigger>
            <ChevronRight
               className={cn("size-4 transition-transform duration-200", {
                  "rotate-180": isOpen,
               })}
            />
         </DropdownMenuTrigger>
         <DropdownMenuContent
            side="right"
            align="start"
            onCloseAutoFocus={(e) => e.preventDefault()}
         >
            <DropdownMenuItem
               className="flex items-center gap-2 cursor-pointer size-full"
               onSelect={(e) => {
                  e.preventDefault();
                  openModal("share", { server, selectAllBuckets: true });
               }}
               disabled={
                  !userRole ||
                  !hasPermissions(userRole, [Permission.MANAGE_VIEWER])
               }
            >
               <Share2 className="size-4" />
               Share All
            </DropdownMenuItem>
            <DropdownMenuItem
               className="flex items-center gap-2 cursor-pointer size-full"
               onSelect={(e) => {
                  e.preventDefault();
                  openModal("rename", { server });
               }}
               disabled={
                  !userRole ||
                  !hasPermissions(userRole, [Permission.RENAME_SERVER])
               }
            >
               <PenLine className="size-4" />
               Rename
            </DropdownMenuItem>
            <DropdownMenuItem
               variant="destructive"
               className="flex items-center gap-2 cursor-pointer size-full"
               onSelect={(e) => {
                  e.preventDefault();
                  openModal("disconnect", { server });
               }}
            >
               {isOwner ? (
                  <>
                     <Trash2 className="size-4 text-viewertextred" />
                     Delete
                  </>
               ) : (
                  <>
                     <WifiOff className="size-4 text-viewertextred" />
                     Disconnect
                  </>
               )}
            </DropdownMenuItem>
         </DropdownMenuContent>
      </DropdownMenu>
   );
};

export default ServerActions;
