import UploadFile from "@/components/Buckets/Actions/upload-file";
import UploadFolder from "@/components/Buckets/Actions/upload-folder";
import { useGridContext } from "@/components/DataGrid/context";
import { useModalContext } from "@/lib/contexts/ModalContext";
import useServers from "@/lib/hooks/queries/server/useServers";
import useSessionStore from "@/lib/stores/sessionStore";
import { Role } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import { cn } from "@s3-viewer/ui/lib/utils";
import { Plus, RefreshCcw, Trash, UserRoundPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useBucketContext } from "../Context";

const ObjectActions = () => {
   const { openShareModal, openCreateBucketModal, openConfirmDeleteModal } =
      useModalContext();

   const [rowsSelected, setRowsSelected] = useState<string[]>([]);
   const [refreshing, setRefreshing] = useState(false);
   const { gridRef, gridReady } = useGridContext();
   const serverId = useSessionStore((state) => state.serverId);
   const { bucket } = useBucketContext();
   const { currentServer } = useServers();

   const bucketRole = bucket?.userRole;
   const serverRole = currentServer?.userRole;
   const canWrite =
      serverRole === Role.OWNER ||
      bucketRole === Role.OWNER ||
      bucketRole === Role.EDITOR ||
      bucketRole === Role.ADMIN;
   const canShare =
      serverRole === Role.OWNER || serverRole === Role.ADMIN;

   useEffect(() => {
      const handleSelectionChanged = () => {
         const rowsSelected = gridRef.current?.api?.getSelectedRows();
         if (rowsSelected) {
            setRowsSelected(rowsSelected.map((row) => row.Key));
         }
      };
      if (gridReady) {
         gridRef.current?.api?.addEventListener(
            "selectionChanged",
            handleSelectionChanged
         );
      }

      return () => {
         gridRef.current?.api?.removeEventListener(
            "selectionChanged",
            handleSelectionChanged
         );
      };
   }, [gridReady]);

   const showDeleteButton = useMemo(() => {
      return (
         rowsSelected.length > 0 &&
         serverId &&
         bucket?.Name &&
         gridRef.current?.api &&
         gridReady
      );
   }, [rowsSelected, serverId, bucket, gridReady]);

   const handleRefresh = useCallback(() => {
      const api = gridRef.current?.api;
      if (!api) return;

      setRefreshing(true);
      api.purgeInfiniteCache();

      const onModelUpdated = () => {
         setRefreshing(false);
         api.removeEventListener("modelUpdated", onModelUpdated);
      };
      api.addEventListener("modelUpdated", onModelUpdated);
   }, [gridRef]);

   return (
      <div className="flex gap-2 @max-3xl/actions:flex-1">
         <Button
            disabled={!gridReady || refreshing}
            onClick={handleRefresh}
            className="@max-3xl/actions:flex-1"
         >
            <RefreshCcw className={cn("size-4",
               refreshing && "animate-spin"
            )} />
            Refresh
         </Button>
         {canShare && (
            <Button
               onClick={() => openShareModal({ server: currentServer ?? undefined })}
               className="@max-3xl/actions:flex-1"
            >
               <UserRoundPlus className="size-4" />
               Share
            </Button>
         )}
         {showDeleteButton && canWrite ? (
            <Button
               variant="destructive"
               onClick={() => {
                  openConfirmDeleteModal({
                     serverId,
                     bucketName: bucket!.Name,
                     fileNames: rowsSelected,
                     onDeleteSuccess: () => {
                        gridRef.current?.api?.purgeInfiniteCache();
                        gridRef.current?.api?.deselectAll();
                     },
                  });
               }}
               className="w-[100px] @max-3xl/actions:flex-1"
            >
               <Trash className="size-4" />
               Delete {rowsSelected.length}
            </Button>
         ) : canWrite ? (
            <DropdownMenu>
               <DropdownMenuTrigger asChild className="focus:outline-none focus:ring-0 focus-visible:ring-0">
                  <Button
                     variant="secondary"
                     onClick={() => openCreateBucketModal({})}
                     className="w-[100px] @max-3xl/actions:flex-1"
                  >
                     <Plus className="size-4" />
                     New
                  </Button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="end" className="w-50">
                  <UploadFolder />
                  <UploadFile />
               </DropdownMenuContent>
            </DropdownMenu>
         ) : null}
      </div>
   );
};

export default ObjectActions;
