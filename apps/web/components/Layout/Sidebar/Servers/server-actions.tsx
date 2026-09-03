import { useModalContext } from "@/lib/contexts/ModalContext";
import { Permission, hasPermission } from "@s3-viewer/permissions";
import { Role, ServerInfo } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import { ChevronRight, LogOut, PenLine, Share2, Trash2 } from "lucide-react";
import { KeyboardEvent, SyntheticEvent } from "react";

const ServerActions = ({ server }: { server: ServerInfo }) => {
   const { openShareModal, openRenameModal, openDisconnectModal } =
      useModalContext();
   const role = server.userRole;
   const isOwner = role === Role.OWNER;
   const stop = (e: SyntheticEvent) => e.stopPropagation();
   const stopKeys = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") e.stopPropagation();
   };

   return (
      <DropdownMenu modal={false}>
         <DropdownMenuTrigger asChild>
            <Button
               variant="ghost"
               size="icon"
               className="size-7 data-[state=open]:[&_svg]:rotate-180"
               aria-label={`Actions for ${server.name}`}
               onClick={stop}
               onPointerUp={stop}
               onKeyDown={stopKeys}
            >
               <ChevronRight
                  aria-hidden="true"
                  className="size-4 transition-transform"
               />
            </Button>
         </DropdownMenuTrigger>
         <DropdownMenuContent
            side="right"
            align="start"
            onClick={stop}
            onPointerUp={stop}
         >
            {hasPermission(role, Permission.MANAGE_MEMBERS) && (
               <DropdownMenuItem onSelect={() => openShareModal({ server })}>
                  <Share2 aria-hidden="true" />
                  Share
               </DropdownMenuItem>
            )}
            {hasPermission(role, Permission.RENAME_SERVER) && (
               <DropdownMenuItem onSelect={() => openRenameModal({ server })}>
                  <PenLine aria-hidden="true" />
                  Rename
               </DropdownMenuItem>
            )}
            <DropdownMenuItem
               variant="destructive"
               onSelect={() => openDisconnectModal({ server })}
            >
               {isOwner ? (
                  <Trash2 aria-hidden="true" />
               ) : (
                  <LogOut aria-hidden="true" />
               )}
               {isOwner ? "Delete" : "Leave"}
            </DropdownMenuItem>
         </DropdownMenuContent>
      </DropdownMenu>
   );
};

export default ServerActions;
