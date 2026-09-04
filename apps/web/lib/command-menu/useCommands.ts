import { PROVIDER_NAMES } from "@/lib/constants";
import { useModalContext } from "@/lib/contexts/ModalContext";
import { signOut } from "@/lib/auth";
import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import useServers from "@/lib/hooks/queries/server/useServers";
import { usePermission } from "@/lib/hooks/usePermission";
import { useShortcutsContext } from "@/lib/shortcuts";
import { SUPPORT_URL } from "@/lib/site-config";
import useSessionStore from "@/lib/stores/sessionStore";
import { errorMessage } from "@/lib/api";
import { folderHref } from "@/lib/utils/s3/paths";
import { Permission, ROLE_LABELS } from "@s3-viewer/permissions";
import { Role, SITE_PATHS } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useSidebar } from "@s3-viewer/ui/components/sidebar";
import {
   ArrowRightLeft,
   CirclePlus,
   Folder,
   KeyRound,
   Keyboard,
   LayoutDashboard,
   LifeBuoy,
   LogOut,
   Mail,
   PanelLeft,
   PenLine,
   Plus,
   Trash2,
   UserRound,
   UserRoundPlus,
} from "lucide-react";
import { useMemo } from "react";
import type { CommandItem } from "./types";

const openSupport = () =>
   window.open(SUPPORT_URL, "_blank", "noopener,noreferrer");

const useCommands = (): CommandItem[] => {
   const { servers, currentServer } = useServers();
   const { buckets } = useBuckets();
   const setServerId = useSessionStore((state) => state.setServerId);
   const { setHelpOpen } = useShortcutsContext();
   const { toggleSidebar } = useSidebar();
   const {
      openConnectModal,
      openCreateBucketModal,
      openDisconnectModal,
      openRenameModal,
      openUpdateCredentialsModal,
   } = useModalContext();

   const canCreateBucket = usePermission(Permission.CREATE_BUCKET);
   const canManageMembers = usePermission(Permission.MANAGE_MEMBERS);
   const canRenameServer = usePermission(Permission.RENAME_SERVER);
   const canUpdateCredentials = usePermission(Permission.UPDATE_CREDENTIALS);

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
            label: "Invites",
            description: "Invitations you have sent and received",
            keywords: "settings invitations pending accept decline revoke",
            icon: Mail,
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
            trailing: ROLE_LABELS[bucket.userRole],
            href: folderHref(bucket.name, []),
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
            run: () => setServerId(server.id),
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
            run: () => openCreateBucketModal({}),
         });
      }

      commands.push({
         id: "action:connect-server",
         group: "Actions",
         label: "Connect a server",
         description: "Add another S3-compatible server",
         keywords: "new add aws r2 endpoint credentials access key",
         icon: CirclePlus,
         run: openConnectModal,
      });

      if (currentServer && canManageMembers) {
         commands.push({
            id: "nav:share",
            group: "Navigation",
            label: "Share server",
            description: currentServer.name,
            keywords: "members people invite permissions roles access team",
            icon: UserRoundPlus,
            href: `/servers/${currentServer.id}/share`,
         });
      }

      if (currentServer && canRenameServer) {
         commands.push({
            id: "action:rename-server",
            group: "Actions",
            label: "Rename server",
            description: currentServer.name,
            keywords: "edit title name",
            icon: PenLine,
            run: () => openRenameModal({ server: currentServer }),
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
            run: () => openUpdateCredentialsModal({ server: currentServer }),
         });
      }

      if (currentServer) {
         const isOwner = currentServer.userRole === Role.OWNER;
         commands.push({
            id: "action:disconnect-server",
            group: "Actions",
            label: isOwner ? "Delete server" : "Leave server",
            description: currentServer.name,
            keywords: "disconnect remove revoke access",
            icon: isOwner ? Trash2 : LogOut,
            destructive: true,
            run: () => openDisconnectModal({ server: currentServer }),
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
            description: "Open an issue on GitHub",
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
            run: () =>
               void signOut().catch((error: unknown) =>
                  toast.error(errorMessage(error))
               ),
         }
      );

      return commands;
   }, [
      buckets,
      canCreateBucket,
      canManageMembers,
      canRenameServer,
      canUpdateCredentials,
      currentServer,
      openConnectModal,
      openCreateBucketModal,
      openDisconnectModal,
      openRenameModal,
      openUpdateCredentialsModal,
      servers,
      setHelpOpen,
      setServerId,
      toggleSidebar,
   ]);
};

export default useCommands;
