import { useGridContext } from "@/components/DataGrid/context";
import { usePermission } from "@/lib/hooks/usePermission";
import { Permission } from "@s3-viewer/permissions";
import { Button } from "@s3-viewer/ui/components/button";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { RefreshCw, Trash2 } from "lucide-react";
import { useBucketContext } from "./Context";
import PrefixSearch from "./Grid/prefix-search";
import UploadMenu from "./Upload/upload-menu";
import useObjectCommands from "./useObjectCommands";

const ObjectsToolbar = () => {
   const { bucketName, refresh, isLoading } = useBucketContext();
   const { selectedIds, clearSelection } = useGridContext();
   const commands = useObjectCommands(bucketName);
   const canUpload = usePermission(Permission.UPLOAD_OBJECT, bucketName);
   const count = selectedIds.length;

   return (
      <div className="flex h-9 items-center gap-2">
         <PrefixSearch className="min-w-0 max-w-sm flex-1" />
         <div
            className="ml-auto flex shrink-0 items-center gap-2"
            aria-busy={isLoading || undefined}
         >
            <Button variant="outline" onClick={refresh}>
               <RefreshCw aria-hidden="true" />
               Refresh
            </Button>
            {isLoading && (
               <>
                  <Skeleton className="h-9 w-32 rounded-lg" />
                  <Skeleton className="h-9 w-24 rounded-lg" />
               </>
            )}
            {!isLoading && canUpload && <UploadMenu />}
            {!isLoading && commands.can.delete && (
               <Button
                  variant="destructive"
                  disabled={count === 0}
                  onClick={() => commands.remove(selectedIds, clearSelection)}
               >
                  <Trash2 aria-hidden="true" />
                  Delete
                  {count > 0 && <span className="tabular-nums">({count})</span>}
               </Button>
            )}
         </div>
      </div>
   );
};

export default ObjectsToolbar;
