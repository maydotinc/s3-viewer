import { useModalContext } from "@/lib/contexts/ModalContext";
import useServers from "@/lib/hooks/queries/server/useServers";
import useSessionStore, { useUserId } from "@/lib/stores/sessionStore";
import { Permission, ROLE_LABELS, hasPermission } from "@s3-viewer/permissions";
import { Role } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuRadioGroup,
   DropdownMenuRadioItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { cn } from "@s3-viewer/ui/lib/utils";
import {
   Check,
   ChevronsUpDown,
   CirclePlus,
   LogOut,
   PenLine,
   Share2,
   Trash2,
} from "lucide-react";
import ServerLogo from "./server-logo";

const TRIGGER =
   "flex h-12 w-full cursor-pointer items-center gap-2 rounded-lg border border-viewerborder bg-viewerwhite px-2 text-left outline-none transition-colors hover:bg-viewergray";

const ServerSelector = () => {
   const {
      openConnectModal,
      openShareModal,
      openRenameModal,
      openDisconnectModal,
   } = useModalContext();
   const { servers, currentServer, isServerListLoading, serverError } =
      useServers();
   const setServerId = useSessionStore((state) => state.setServerId);
   const userId = useUserId();

   if (!userId || isServerListLoading) {
      return <Skeleton className="h-12 w-full rounded-lg" />;
   }

   if (serverError) {
      return (
         <p
            role="alert"
            className="flex h-12 w-full items-center rounded-lg border border-viewerborder px-2 text-sm text-viewertextred"
         >
            <span className="min-w-0 flex-1 truncate">
               {serverError.message}
            </span>
         </p>
      );
   }

   if (!currentServer) {
      return (
         <Button
            variant="outline"
            className="h-12 w-full"
            onClick={openConnectModal}
         >
            <CirclePlus aria-hidden="true" />
            Add server
         </Button>
      );
   }

   const role = currentServer.userRole;
   const isOwner = role === Role.OWNER;

   return (
      <DropdownMenu>
         <DropdownMenuTrigger aria-label="Switch server" className={TRIGGER}>
            <ServerLogo provider={currentServer.provider} />
            <span className="flex min-w-0 flex-1 flex-col">
               <span className="min-w-0 flex-1 truncate font-medium text-viewerblack">
                  {currentServer.name}
               </span>
               <span className="truncate text-xs text-viewertext">
                  {ROLE_LABELS[currentServer.userRole]}
               </span>
            </span>
            <ChevronsUpDown
               aria-hidden="true"
               className="size-4 shrink-0 text-viewerlighttext"
            />
         </DropdownMenuTrigger>
         <DropdownMenuContent
            align="start"
            className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-64"
         >
            <DropdownMenuLabel>Servers</DropdownMenuLabel>
            <DropdownMenuRadioGroup
               value={currentServer.id}
               onValueChange={setServerId}
            >
               {servers.map((server) => {
                  const isCurrent = server.id === currentServer.id;
                  return (
                     <DropdownMenuRadioItem
                        key={server.id}
                        value={server.id}
                        textValue={server.name}
                        /* The primitive's left radio dot is replaced by the
                           trailing check, so hide it and drop its inset. */
                        className={cn(
                           "pl-2.5 [&>span:first-child]:hidden",
                           isCurrent && "bg-viewergray"
                        )}
                     >
                        <ServerLogo provider={server.provider} />
                        <span className="flex min-w-0 flex-1 flex-col">
                           <span className="min-w-0 flex-1 truncate text-viewerblack">
                              {server.name}
                           </span>
                           <span className="truncate text-xs text-viewerlighttext">
                              {ROLE_LABELS[server.userRole]}
                           </span>
                        </span>
                        {isCurrent && (
                           <Check
                              aria-hidden="true"
                              className="size-4 shrink-0 text-viewerblue"
                           />
                        )}
                     </DropdownMenuRadioItem>
                  );
               })}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={openConnectModal}>
               <CirclePlus aria-hidden="true" />
               Add server
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="truncate">
               {currentServer.name}
            </DropdownMenuLabel>
            {hasPermission(role, Permission.MANAGE_MEMBERS) && (
               <DropdownMenuItem
                  onSelect={() => openShareModal({ server: currentServer })}
               >
                  <Share2 aria-hidden="true" />
                  Share
               </DropdownMenuItem>
            )}
            {hasPermission(role, Permission.RENAME_SERVER) && (
               <DropdownMenuItem
                  onSelect={() => openRenameModal({ server: currentServer })}
               >
                  <PenLine aria-hidden="true" />
                  Rename
               </DropdownMenuItem>
            )}
            <DropdownMenuItem
               variant="destructive"
               onSelect={() => openDisconnectModal({ server: currentServer })}
            >
               {isOwner ? (
                  <Trash2 aria-hidden="true" />
               ) : (
                  <LogOut aria-hidden="true" />
               )}
               {isOwner ? "Delete server" : "Leave server"}
            </DropdownMenuItem>
         </DropdownMenuContent>
      </DropdownMenu>
   );
};

export default ServerSelector;
