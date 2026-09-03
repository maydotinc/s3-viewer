import { useModalContext } from "@/lib/contexts/ModalContext";
import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import useServers from "@/lib/hooks/queries/server/useServers";
import { usePermission } from "@/lib/hooks/usePermission";
import { focusToolbarFilter, useShortcut } from "@/lib/shortcuts";
import { Permission } from "@s3-viewer/permissions";
import { Button } from "@s3-viewer/ui/components/button";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
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
   // The filter input is the sibling at the other end of this toolbar row.
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

   // Placeholders the size of the real buttons, so the row does not reflow
   // when the actions arrive — but only for the buttons this user is going to
   // get. Refresh needs no permission, so it is never a placeholder.
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
         {canShare &&
            (pending || !currentServer ? (
               <Skeleton className="h-9 w-24 rounded-lg" />
            ) : (
               <SimpleTooltip label="Manage who can see this server">
                  <Button variant="outline" asChild>
                     <Link href={`/servers/${currentServer.id}/share`}>
                        <UserRoundPlus aria-hidden="true" />
                        Share
                     </Link>
                  </Button>
               </SimpleTooltip>
            ))}
         {canCreate &&
            (pending ? (
               <Skeleton className="h-9 w-36 rounded-lg" />
            ) : (
               <SimpleTooltip label="Create bucket" shortcut="n">
                  <Button onClick={() => openCreateBucketModal({})}>
                     <Plus aria-hidden="true" />
                     Create bucket
                  </Button>
               </SimpleTooltip>
            ))}
      </div>
   );
};

export default BucketActions;
