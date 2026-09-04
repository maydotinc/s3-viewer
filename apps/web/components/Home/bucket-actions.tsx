import { useModalContext } from "@/lib/contexts/ModalContext";
import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import useServers from "@/lib/hooks/queries/server/useServers";
import { usePermission } from "@/lib/hooks/usePermission";
import { focusToolbarFilter, useShortcut } from "@/lib/shortcuts";
import { Permission } from "@s3-viewer/permissions";
import { Button } from "@s3-viewer/ui/components/button";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import { Plus, RefreshCw, UserRoundPlus } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

const BucketActions = () => {
   const { openCreateBucketModal } = useModalContext();
   const { currentServer, isSessionPending, isServerListLoading } =
      useServers();
   const { refetch } = useBuckets();
   const canShare = usePermission(Permission.MANAGE_MEMBERS);
   const canCreate = usePermission(Permission.CREATE_BUCKET);
   const actionsRef = useRef<HTMLDivElement>(null);

   const pending = isSessionPending || isServerListLoading;

   useShortcut({
      keys: "/",
      label: "Filter buckets",
      group: "Buckets",
      handler: () => focusToolbarFilter(actionsRef.current),
   });

   useShortcut({
      keys: "r",
      label: "Refresh buckets",
      group: "Buckets",
      handler: () => void refetch(),
   });

   useShortcut({
      keys: "n",
      label: "Create bucket",
      group: "Buckets",
      when: () => !pending && canCreate,
      handler: () => openCreateBucketModal({}),
   });

   // While the session and server list load the real buttons render disabled
   // rather than as placeholders: a placeholder can only approximate a label's
   // width, so the row visibly settled when the buttons replaced it. Only the
   // buttons this user is going to get are rendered at all.
   return (
      <div
         ref={actionsRef}
         className="ml-auto flex min-h-9 flex-wrap items-center justify-end gap-2"
         aria-busy={pending || undefined}
      >
         <SimpleTooltip label="Refresh" shortcut="r">
            <Button variant="outline" onClick={() => void refetch()}>
               <RefreshCw aria-hidden="true" />
               Refresh
            </Button>
         </SimpleTooltip>
         {canShare && (
            <SimpleTooltip label="Manage who can see this server">
               {pending || !currentServer ? (
                  <Button variant="outline" disabled>
                     <UserRoundPlus aria-hidden="true" />
                     Share
                  </Button>
               ) : (
                  <Button variant="outline" asChild>
                     <Link href={`/servers/${currentServer.id}/share`}>
                        <UserRoundPlus aria-hidden="true" />
                        Share
                     </Link>
                  </Button>
               )}
            </SimpleTooltip>
         )}
         {canCreate && (
            <SimpleTooltip label="Create bucket" shortcut="n">
               <Button
                  disabled={pending}
                  onClick={() => openCreateBucketModal({})}
               >
                  <Plus aria-hidden="true" />
                  Create bucket
               </Button>
            </SimpleTooltip>
         )}
      </div>
   );
};

export default BucketActions;
