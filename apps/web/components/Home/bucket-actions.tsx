import Reserve from "@/components/reserve";
import { useModalActions } from "@/lib/contexts/modal-context";
import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import useCurrentServer from "@/lib/hooks/queries/server/useCurrentServer";
import { useCanCreateBucket, usePermission } from "@/lib/hooks/usePermission";
import { sharePath } from "@/lib/server-paths";
import { useShortcut } from "@/lib/shortcuts";
import { focusToolbarFilter } from "@/lib/utils/dom";
import { Permission } from "@s3-viewer/permissions";
import { Button } from "@s3-viewer/ui/components/button";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import { Plus, RefreshCw, UserRoundPlus } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

const BucketActions = () => {
   const { open } = useModalActions();
   const { currentServer, isLoading: pending } = useCurrentServer();
   const { refetch } = useBuckets();
   const canShare = usePermission(Permission.MANAGE_MEMBERS);
   const canCreate = useCanCreateBucket();
   const actionsRef = useRef<HTMLDivElement>(null);

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
      handler: () => open("createBucket", {}),
   });

   return (
      <div
         ref={actionsRef}
         className="-mx-1 flex h-11 min-w-0 items-center gap-2 overflow-x-auto px-1 [&>*]:shrink-0"
         aria-busy={pending || undefined}
      >
         <SimpleTooltip label="Refresh" shortcut="r">
            <Button
               variant="outline"
               className="max-sm:w-9 max-sm:px-0"
               onClick={() => void refetch()}
            >
               <RefreshCw aria-hidden="true" />
               <span className="max-sm:sr-only">Refresh</span>
            </Button>
         </SimpleTooltip>
         <Reserve show={canShare} className="inline-flex">
            <SimpleTooltip label="Manage who can see this server">
               {pending || !currentServer ? (
                  <Button variant="outline" className="max-sm:px-3" disabled>
                     <UserRoundPlus aria-hidden="true" />
                     Share
                  </Button>
               ) : (
                  <Button variant="outline" className="max-sm:px-3" asChild>
                     <Link href={sharePath(currentServer.id)}>
                        <UserRoundPlus aria-hidden="true" />
                        Share
                     </Link>
                  </Button>
               )}
            </SimpleTooltip>
         </Reserve>
         <Reserve show={canCreate} className="inline-flex">
            <SimpleTooltip label="Create bucket" shortcut="n">
               <Button
                  className="max-sm:px-3"
                  disabled={pending}
                  onClick={() => open("createBucket", {})}
               >
                  <Plus aria-hidden="true" />
                  Create bucket
               </Button>
            </SimpleTooltip>
         </Reserve>
      </div>
   );
};

export default BucketActions;
