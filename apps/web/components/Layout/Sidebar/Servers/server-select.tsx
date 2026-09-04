import { useModalActions } from "@/lib/contexts/ModalContext";
import useServers from "@/lib/hooks/queries/server/useServers";
import useSessionStore, { useUserId } from "@/lib/stores/sessionStore";
import { Permission, ROLE_LABELS, hasPermission } from "@s3-viewer/permissions";
import { Role, ServerInfo } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuGroup,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuSeparator,
   DropdownMenuSub,
   DropdownMenuSubContent,
   DropdownMenuSubTrigger,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { cn } from "@s3-viewer/ui/lib/utils";
import {
   ArrowRightLeft,
   Check,
   ChevronsUpDown,
   CirclePlus,
   LogOut,
   PenLine,
   Share2,
   Trash2,
} from "lucide-react";
import { useRouter } from "next/router";
import { useState } from "react";
import ServerLogo from "./server-logo";

const TRIGGER =
   "flex h-12 w-full cursor-pointer items-center gap-2.5 rounded-lg border border-viewerborder bg-viewerwhite px-3 text-left outline-none transition-colors duration-150 hover:bg-viewergray";

const ServerSelector = () => {
   const { openConnectModal, openRenameModal, openDisconnectModal } =
      useModalActions();
   const { servers, currentServer, isServerListLoading, serverError } =
      useServers();
   const setServerId = useSessionStore((state) => state.setServerId);
   const userId = useUserId();
   const router = useRouter();
   const [open, setOpen] = useState(false);

   if (!userId || isServerListLoading) {
      return <Skeleton className="h-12 w-full rounded-lg" />;
   }

   if (serverError) {
      return (
         <p
            role="alert"
            className="flex h-12 w-full items-center rounded-lg border border-viewerborder px-3 text-sm text-viewertextred"
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

   const switchTo = (server: ServerInfo) => {
      setOpen(false);
      if (server.id !== currentServer.id) setServerId(server.id);
   };

   return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
         <DropdownMenuTrigger aria-label="Switch server" className={TRIGGER}>
            <ServerLogo provider={currentServer.provider} />
            <span className="flex min-w-0 flex-1 flex-col">
               <span className="min-w-0 flex-1 truncate text-sm font-medium text-viewerblack">
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
            <DropdownMenuGroup>
               {servers.map((server) => {
                  const isCurrent = server.id === currentServer.id;
                  const isOwner = server.userRole === Role.OWNER;
                  return (
                     <DropdownMenuSub key={server.id}>
                        <DropdownMenuSubTrigger
                           textValue={server.name}
                           aria-current={isCurrent ? "true" : undefined}
                           className={cn(isCurrent && "bg-viewergray")}
                           onClick={(event) => {
                              if (isCurrent) return;
                              // stop radix from opening the submenu on a click
                              // that is really "switch to this server".
                              event.preventDefault();
                              switchTo(server);
                           }}
                           onKeyDown={(event) => {
                              // enter switches. space and → keep radix's
                              // default (open the submenu) — space also has to
                              // stay typeable, server names contain spaces.
                              if (isCurrent || event.key !== "Enter") return;
                              event.preventDefault();
                              switchTo(server);
                           }}
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
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                           {isCurrent ? (
                              <DropdownMenuLabel>
                                 Current server
                              </DropdownMenuLabel>
                           ) : (
                              <DropdownMenuItem
                                 onSelect={() => switchTo(server)}
                              >
                                 <ArrowRightLeft aria-hidden="true" />
                                 <span className="min-w-0 truncate">
                                    Switch to {server.name}
                                 </span>
                              </DropdownMenuItem>
                           )}
                           <DropdownMenuSeparator />
                           {hasPermission(
                              server.userRole,
                              Permission.MANAGE_MEMBERS
                           ) && (
                              <DropdownMenuItem
                                 onSelect={() =>
                                    router.push(`/servers/${server.id}/share`)
                                 }
                              >
                                 <Share2 aria-hidden="true" />
                                 Share
                              </DropdownMenuItem>
                           )}
                           {hasPermission(
                              server.userRole,
                              Permission.RENAME_SERVER
                           ) && (
                              <DropdownMenuItem
                                 onSelect={() => openRenameModal({ server })}
                              >
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
                              {isOwner ? "Delete server" : "Leave server"}
                           </DropdownMenuItem>
                        </DropdownMenuSubContent>
                     </DropdownMenuSub>
                  );
               })}
            </DropdownMenuGroup>
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
