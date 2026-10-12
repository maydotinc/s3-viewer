import InlineAlert from "@/components/inline-alert";
import { loadNext } from "@/components/list-pagination";
import { useSwitchServer } from "@/lib/hooks/useSwitchServer";
import { useModalActions } from "@/lib/contexts/modal-context";
import useServers from "@/lib/hooks/queries/server/useServers";
import { auditPath, sharePath } from "@/lib/server-paths";
import { useUserId } from "@/lib/stores/session-store";
import { Permission, ROLE_LABELS, hasPermission } from "@s3-viewer/permissions";
import { Role, type ServerInfo } from "@s3-viewer/types";
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
   CircleAlert,
   ChevronsUpDown,
   CirclePlus,
   LogOut,
   PenLine,
   ScrollText,
   Share2,
   Trash2,
} from "lucide-react";
import { useRouter } from "next/router";
import { useRef, useState } from "react";
import ServerLogo from "./server-logo";

const TRIGGER =
   "flex h-12 w-full cursor-pointer items-center gap-2.5 rounded-lg border border-viewerborder bg-viewerwhite px-3 text-left outline-none transition-colors duration-150 hover:bg-viewergray";

const ServerSelect = () => {
   const { open: openModal } = useModalActions();
   const {
      servers,
      currentServer,
      isLoading,
      serverError,
      serverListError,
      hasNextPage,
      isFetching,
      isFetchNextPageError,
      fetchNextPage,
      refetch,
      refetchCurrentServer,
      isFetchingCurrentServer,
   } = useServers();
   const switchServer = useSwitchServer();
   const userId = useUserId();
   const router = useRouter();
   const [open, setOpen] = useState(false);
   const pointerType = useRef("");

   if (!userId || isLoading) {
      return <Skeleton className="h-12 w-full rounded-lg" />;
   }

   if (
      serverError &&
      !currentServer &&
      !servers.length &&
      !hasNextPage &&
      !serverListError
   ) {
      return (
         <div
            role="alert"
            className="flex h-12 w-full min-w-0 items-center gap-2 rounded-lg border border-viewerborder py-1 pr-1 pl-3"
         >
            <CircleAlert
               aria-hidden="true"
               className="size-4 shrink-0 text-viewertextred"
            />
            <span className="flex min-w-0 flex-1 flex-col">
               <span className="truncate text-sm font-medium text-viewerblack">
                  Couldn&apos;t load server
               </span>
               <span
                  className="truncate text-xs text-viewertext"
                  title={serverError.message}
               >
                  {serverError.message}
               </span>
            </span>
            <Button
               variant="outline"
               size="sm"
               className="shrink-0"
               loading={isFetchingCurrentServer}
               onClick={() => void refetchCurrentServer()}
            >
               Try again
            </Button>
         </div>
      );
   }

   if (!currentServer && !servers.length && !hasNextPage && !serverListError) {
      return (
         <Button
            variant="outline"
            className="h-12 w-full"
            onClick={() => openModal("connect", {})}
         >
            <CirclePlus aria-hidden="true" />
            Add server
         </Button>
      );
   }

   const switchTo = (server: ServerInfo) => {
      setOpen(false);
      if (server.id !== currentServer?.id) void switchServer(server.id);
   };

   return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
         <DropdownMenuTrigger
            aria-label={
               currentServer
                  ? `Switch server, current: ${currentServer.name}`
                  : "Switch server"
            }
            className={TRIGGER}
         >
            {currentServer && <ServerLogo provider={currentServer.provider} />}
            <span className="flex min-w-0 flex-1 flex-col">
               <span
                  title={currentServer?.name}
                  className="min-w-0 flex-1 truncate text-sm font-medium text-viewerblack"
               >
                  {currentServer?.name ?? "Choose a server"}
               </span>
               {currentServer && (
                  <span className="truncate text-xs text-viewertext">
                     {ROLE_LABELS[currentServer.userRole]}
                  </span>
               )}
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
            {serverError && (
               <>
                  <InlineAlert variant="plain" className="px-2 py-1.5">
                     {serverError.message}
                  </InlineAlert>
                  <DropdownMenuItem
                     disabled={isFetchingCurrentServer}
                     onSelect={(event) => {
                        event.preventDefault();
                        void refetchCurrentServer();
                     }}
                  >
                     Try loading this server again
                  </DropdownMenuItem>
               </>
            )}
            <DropdownMenuGroup>
               {servers.map((server) => {
                  const isCurrent = server.id === currentServer?.id;
                  const isOwner = server.userRole === Role.OWNER;
                  return (
                     <DropdownMenuSub key={server.id}>
                        <DropdownMenuSubTrigger
                           textValue={server.name}
                           aria-current={isCurrent ? "true" : undefined}
                           className={cn(isCurrent && "bg-viewergray")}
                           onPointerDown={(event) => {
                              pointerType.current = event.pointerType;
                           }}
                           onClick={(event) => {
                              // touch has no hover to open the submenu, so a tap opens it and its first item switches
                              if (isCurrent || pointerType.current === "touch")
                                 return;
                              event.preventDefault();
                              switchTo(server);
                           }}
                           onKeyDown={(event) => {
                              if (isCurrent || event.key !== "Enter") return;
                              event.preventDefault();
                              switchTo(server);
                           }}
                        >
                           <ServerLogo provider={server.provider} />
                           <span className="flex min-w-0 flex-1 flex-col">
                              <span
                                 title={server.name}
                                 className="min-w-0 flex-1 truncate text-viewerblack"
                              >
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
                                    router.push(sharePath(server.id))
                                 }
                              >
                                 <Share2 aria-hidden="true" />
                                 Share
                              </DropdownMenuItem>
                           )}
                           {(server.audit.canView ||
                              server.audit.canManage) && (
                              <DropdownMenuItem
                                 onSelect={() =>
                                    router.push(auditPath(server.id))
                                 }
                              >
                                 <ScrollText aria-hidden="true" />
                                 Audit log
                              </DropdownMenuItem>
                           )}
                           {hasPermission(
                              server.userRole,
                              Permission.RENAME_SERVER
                           ) && (
                              <DropdownMenuItem
                                 onSelect={() =>
                                    openModal("rename", { server })
                                 }
                              >
                                 <PenLine aria-hidden="true" />
                                 Rename
                              </DropdownMenuItem>
                           )}
                           <DropdownMenuItem
                              variant="destructive"
                              onSelect={() =>
                                 openModal("disconnect", { server })
                              }
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
            {serverListError && (
               <InlineAlert variant="plain" className="px-2 py-1.5">
                  {serverListError.message}
               </InlineAlert>
            )}
            {(hasNextPage || serverListError) && (
               <DropdownMenuItem
                  disabled={isFetching}
                  onSelect={(event) => {
                     event.preventDefault();
                     void loadNext({
                        error: serverListError,
                        isFetchNextPageError,
                        fetchNextPage,
                        refetch,
                     });
                  }}
               >
                  {isFetching
                     ? "Loading servers…"
                     : serverListError
                       ? "Try again"
                       : "Load more servers"}
               </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => openModal("connect", {})}>
               <CirclePlus aria-hidden="true" />
               Add server
            </DropdownMenuItem>
         </DropdownMenuContent>
      </DropdownMenu>
   );
};

export default ServerSelect;
