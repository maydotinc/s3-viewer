import { useSwitchServer } from "@/lib/hooks/useSwitchServer";
import { PROVIDER_NAMES } from "@/lib/constants";
import { useModalActions } from "@/lib/contexts/modal-context";
import { requestSignOut } from "@/lib/auth";
import { notifyListingChanged } from "@/lib/listing-events";
import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import useServers from "@/lib/hooks/queries/server/useServers";
import {
   canCreateBucketOn,
   objectPermissions,
   useEffectiveRoleState,
} from "@/lib/hooks/usePermission";
import { useStorageCapabilities } from "@/lib/hooks/useStorageCapabilities";
import { invitePeoplePath, membersPath } from "@/lib/server-paths";
import { useShortcutRegistry } from "@/lib/shortcuts";
import { supportUrl } from "@/lib/site-config";
import { useServerId } from "@/lib/stores/session-scope";
import { reachOf, writeBlockReason } from "@/lib/utils/folder-access";
import {
   bucketEntryHref,
   bucketRoute,
   folderHref,
   prefixFromSegments,
   segmentsFromKey,
} from "@/lib/utils/s3/paths";
import { toastFailure } from "@/lib/utils/toast";
import { Permission, ROLE_LABELS, hasPermission } from "@s3-viewer/permissions";
import { SITE_PATHS } from "@s3-viewer/types";
import { useSidebar } from "@s3-viewer/ui/components/sidebar";
import {
   ArrowRightLeft,
   CirclePlus,
   Folder,
   FolderPlus,
   KeyRound,
   Keyboard,
   LayoutDashboard,
   LifeBuoy,
   LogOut,
   MailOpen,
   PanelLeft,
   PenLine,
   Plus,
   Replace,
   Trash2,
   UserRound,
   UserRoundPlus,
   Users,
} from "lucide-react";
import { useRouter } from "next/router";
import { useMemo } from "react";
import type { CommandItem } from "./types";

const openSupport = () =>
   window.open(supportUrl(), "_blank", "noopener,noreferrer");

const useCommands = (): CommandItem[] => {
   const router = useRouter();
   const {
      servers,
      currentServer,
      hasNextPage,
      isFetching,
      fetchNextPage,
      serverListError,
      isFetchNextPageError,
      refetch,
   } = useServers();
   const serverId = useServerId();
   const route = bucketRoute(router.query);
   // a bucket URL for a server not yet selected must not offer actions against the selected one
   const bucketName = route.serverId === serverId ? route.bucketName : "";
   const { buckets, currentBucket } = useBuckets(bucketName);
   const switchServer = useSwitchServer();
   const { setHelpOpen } = useShortcutRegistry();
   const { toggleSidebar } = useSidebar();
   const { open: openModal, openScoped } = useModalActions();

   const folderPrefix = prefixFromSegments(route.path);
   const inFolder =
      Boolean(currentBucket) &&
      !route.isObjectView &&
      writeBlockReason(reachOf(currentBucket), folderPrefix) === null;
   const capabilities = useStorageCapabilities();
   const { role: roleHere } = useEffectiveRoleState(bucketName);
   const serverRole = currentServer?.userRole ?? null;
   const can = objectPermissions(roleHere, capabilities);
   const canCreateFolder = inFolder && can.upload;
   const canTransferFolder = inFolder && can.download && folderPrefix !== "";
   const canBulkRename =
      inFolder && folderPrefix !== "" && can.rename && can.upload;
   const canCreateBucket = canCreateBucketOn(currentServer);
   const canManageMembers = hasPermission(
      serverRole,
      Permission.MANAGE_MEMBERS
   );
   const canRenameServer = hasPermission(serverRole, Permission.RENAME_SERVER);
   const canUpdateCredentials = hasPermission(
      serverRole,
      Permission.UPDATE_CREDENTIALS
   );

   return useMemo(() => {
      const commands: CommandItem[] = [
         {
            id: "nav:dashboard",
            group: "Navigation",
            label: "Dashboard",
            keywords: "home overview buckets list",
            icon: LayoutDashboard,
            shortcut: "g d",
            href: SITE_PATHS.dashboard,
         },
         {
            id: "nav:profile",
            group: "Navigation",
            label: "Profile",
            description: "Your name, email and account",
            keywords: "settings account delete email name",
            icon: UserRound,
            shortcut: "g s",
            href: SITE_PATHS.settingsProfile,
         },
         {
            id: "nav:invites",
            group: "Navigation",
            label: "Invitations",
            description: "Servers you've been invited to",
            keywords: "settings invitations received accept decline",
            icon: MailOpen,
            href: SITE_PATHS.settingsInvites,
         },
      ];

      for (const bucket of buckets) {
         commands.push({
            id: `bucket:${bucket.name}`,
            group: "Buckets",
            label: bucket.name,
            keywords: "bucket objects files folder browse open",
            icon: Folder,
            trailing:
               bucket.folders === null
                  ? ROLE_LABELS[bucket.userRole]
                  : `${ROLE_LABELS[bucket.userRole]} · Folders only`,
            href: bucketEntryHref(serverId, bucket),
         });
      }

      for (const server of servers) {
         if (server.id === currentServer?.id) continue;
         commands.push({
            id: `server:${server.id}`,
            group: "Servers",
            label: server.name,
            keywords: `switch server connection ${PROVIDER_NAMES[server.provider]}`,
            icon: ArrowRightLeft,
            trailing: ROLE_LABELS[server.userRole],
            run: () => void switchServer(server.id),
         });
      }

      if ((hasNextPage || serverListError) && !isFetching) {
         commands.push({
            id: "server:load-more",
            group: "Servers",
            label: serverListError
               ? "Retry loading servers"
               : "Load more servers",
            keywords: "switch server connection more load",
            icon: ArrowRightLeft,
            run: () =>
               void (
                  serverListError && !isFetchNextPageError
                     ? refetch
                     : fetchNextPage
               )({ cancelRefetch: false }),
         });
      }

      if (canCreateBucket) {
         commands.push({
            id: "action:create-bucket",
            group: "Actions",
            label: "Create bucket",
            keywords: "new add make bucket",
            icon: Plus,
            shortcut: "n",
            run: () => openModal("createBucket", {}),
         });
      }

      if (canCreateFolder) {
         commands.push({
            id: "action:create-folder",
            group: "Actions",
            label: "New folder",
            description: `${bucketName}/${folderPrefix}`,
            keywords: "make directory prefix add empty",
            icon: FolderPlus,
            run: () =>
               openScoped("createFolder", {
                  serverId,
                  bucketName,
                  prefix: folderPrefix,
                  onCreateSuccess: (folderKey) =>
                     void router.push(
                        folderHref(
                           serverId,
                           bucketName,
                           segmentsFromKey(folderKey)
                        )
                     ),
               }),
         });
      }

      if (canBulkRename) {
         commands.push({
            id: "action:bulk-rename",
            group: "Actions",
            label: "Bulk rename…",
            description: `${bucketName}/${folderPrefix}`,
            keywords: "pattern find replace prefix suffix extension lowercase",
            icon: Replace,
            run: () =>
               openScoped("bulkRename", {
                  serverId,
                  bucketName,
                  source: { folderKey: folderPrefix },
                  onRenamed: () => notifyListingChanged(),
               }),
         });
      }

      if (canTransferFolder) {
         commands.push({
            id: "action:transfer-folder",
            group: "Actions",
            label: "Copy folder to another bucket",
            description: `${bucketName}/${folderPrefix}`,
            keywords: "transfer across server bucket duplicate sync",
            icon: ArrowRightLeft,
            run: () =>
               openScoped("transferObjects", {
                  serverId,
                  bucketName,
                  source: { folderKey: folderPrefix },
               }),
         });
      }

      commands.push({
         id: "action:connect-server",
         group: "Actions",
         label: "Connect a server",
         description: "Add another S3-compatible server",
         keywords: "new add aws r2 endpoint credentials access key",
         icon: CirclePlus,
         run: () => openModal("connect", {}),
      });

      if (currentServer && canManageMembers) {
         commands.push(
            {
               id: "nav:invite",
               group: "Navigation",
               label: "Invite people",
               description: currentServer.name,
               keywords: "invite share people access team email",
               icon: UserRoundPlus,
               href: invitePeoplePath(currentServer.id),
            },
            {
               id: "nav:members",
               group: "Navigation",
               label: "Manage members",
               description: currentServer.name,
               keywords: "members people roles permissions remove access",
               icon: Users,
               href: membersPath(currentServer.id),
            }
         );
      }

      if (currentServer && canRenameServer) {
         commands.push({
            id: "action:rename-server",
            group: "Actions",
            label: "Rename server",
            description: currentServer.name,
            keywords: "edit title name",
            icon: PenLine,
            run: () => openModal("rename", { server: currentServer }),
         });
      }

      if (currentServer && canUpdateCredentials) {
         commands.push({
            id: "action:update-credentials",
            group: "Actions",
            label: "Update credentials",
            description: currentServer.name,
            keywords: "keys access secret rotate endpoint",
            icon: KeyRound,
            run: () =>
               openModal("updateCredentials", { server: currentServer }),
         });
      }

      if (currentServer) {
         const isOwner = hasPermission(
            currentServer.userRole,
            Permission.DELETE_SERVER
         );
         commands.push({
            id: "action:disconnect-server",
            group: "Actions",
            label: isOwner ? "Delete server" : "Leave server",
            description: currentServer.name,
            keywords: "disconnect remove revoke access",
            icon: isOwner ? Trash2 : LogOut,
            destructive: true,
            run: () => openModal("disconnect", { server: currentServer }),
         });
      }

      commands.push(
         {
            id: "action:toggle-sidebar",
            group: "Actions",
            label: "Toggle sidebar",
            keywords: "hide show collapse expand panel navigation",
            icon: PanelLeft,
            shortcut: "mod b",
            run: toggleSidebar,
         },
         {
            id: "action:shortcuts",
            group: "Actions",
            label: "Keyboard shortcuts",
            keywords: "keys hotkeys help bindings cheat sheet",
            icon: Keyboard,
            shortcut: "?",
            run: () => setHelpOpen(true),
         },
         {
            id: "action:support",
            group: "Actions",
            label: "Support",
            description: "Contact support",
            keywords: "help contact bug report feedback",
            icon: LifeBuoy,
            run: openSupport,
         },
         {
            id: "action:sign-out",
            group: "Actions",
            label: "Sign out",
            keywords: "log out exit leave session",
            icon: LogOut,
            destructive: true,
            run: () => void requestSignOut().catch(toastFailure),
         }
      );

      return commands;
   }, [
      buckets,
      canCreateBucket,
      canBulkRename,
      canCreateFolder,
      canTransferFolder,
      folderPrefix,
      openModal,
      openScoped,
      bucketName,
      router,
      serverId,
      canManageMembers,
      canRenameServer,
      canUpdateCredentials,
      currentServer,
      servers,
      hasNextPage,
      isFetching,
      fetchNextPage,
      serverListError,
      isFetchNextPageError,
      refetch,
      setHelpOpen,
      switchServer,
      toggleSidebar,
   ]);
};

export default useCommands;
