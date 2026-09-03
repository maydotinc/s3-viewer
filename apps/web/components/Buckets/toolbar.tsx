import { useGridContext } from "@/components/DataGrid/context";
import PageSize from "@/components/DataGrid/page-size";
import { usePermission } from "@/lib/hooks/usePermission";
import { Permission } from "@s3-viewer/permissions";
import { Button } from "@s3-viewer/ui/components/button";
import { Spinner } from "@s3-viewer/ui/components/spinner";
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
      <div className="flex flex-wrap items-center gap-2 pb-4">
         <PrefixSearch className="min-w-56 flex-1" />
         <PageSize />
         <Button variant="outline" onClick={refresh}>
            <RefreshCw aria-hidden="true" />
            Refresh
         </Button>
         <div className="flex h-9 min-w-[232px] items-center justify-end gap-2">
            {isLoading ? (
               <Spinner size="sm" label="Loading actions" />
            ) : (
               <div className="fade-in flex items-center gap-2">
                  {canUpload && <UploadMenu className="min-w-28" />}
                  {commands.can.delete && (
                     <Button
                        variant="destructive"
                        className="min-w-28"
                        disabled={count === 0}
                        onClick={() =>
                           commands.remove(selectedIds, clearSelection)
                        }
                     >
                        <Trash2 aria-hidden="true" />
                        Delete{count > 0 ? ` (${count})` : ""}
                     </Button>
                  )}
               </div>
            )}
         </div>
      </div>
   );
};

export default ObjectsToolbar;
