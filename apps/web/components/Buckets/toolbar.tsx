import { useGridContext } from "@/components/DataGrid/context";
import { usePermission } from "@/lib/hooks/usePermission";
import { useShortcut } from "@/lib/shortcuts";
import { Permission } from "@s3-viewer/permissions";
import { Button } from "@s3-viewer/ui/components/button";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
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

   useShortcut({
      keys: "r",
      label: "Refresh objects",
      group: "Objects",
      handler: refresh,
   });

   useShortcut({
      // ⌫ is the key people actually reach for; ⌦ does the same thing.
      keys: "backspace",
      aliases: ["delete"],
      label: "Delete selected objects",
      group: "Objects",
      when: () => commands.can.delete && count > 0,
      handler: () => commands.remove(selectedIds, clearSelection),
   });

   return (
      <div className="flex min-h-9 flex-wrap items-center gap-2">
         <PrefixSearch className="w-72 shrink-0" />
         <div
            className="ml-auto flex flex-wrap items-center justify-end gap-2"
            aria-busy={isLoading || undefined}
         >
            <SimpleTooltip label="Refresh" shortcut="r">
               <Button variant="outline" onClick={refresh}>
                  <RefreshCw aria-hidden="true" />
                  Refresh
               </Button>
            </SimpleTooltip>
            {/* A placeholder only where a button is actually going to land:
                a viewer who cannot upload should not watch an Upload-sized
                skeleton appear and then vanish. */}
            {canUpload &&
               (isLoading ? (
                  <Skeleton className="h-9 w-32 rounded-lg" />
               ) : (
                  <UploadMenu />
               ))}
            {commands.can.delete &&
               (isLoading ? (
                  <Skeleton className="h-9 w-24 rounded-lg" />
               ) : (
                  <SimpleTooltip label="Delete selection" shortcut="backspace">
                     <Button
                        variant="destructive"
                        disabled={count === 0}
                        onClick={() =>
                           commands.remove(selectedIds, clearSelection)
                        }
                     >
                        <Trash2 aria-hidden="true" />
                        Delete
                        {count > 0 && (
                           <span className="tabular-nums">({count})</span>
                        )}
                     </Button>
                  </SimpleTooltip>
               ))}
         </div>
      </div>
   );
};

export default ObjectsToolbar;
