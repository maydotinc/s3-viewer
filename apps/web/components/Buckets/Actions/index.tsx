import UploadFile from "@/components/Buckets/Actions/upload-file";
import UploadFolder from "@/components/Buckets/Actions/upload-folder";
import { useGridContext } from "@/components/DataGrid/context";
import { useModalContext } from "@/lib/contexts/ModalContext";
import useSessionStore from "@/lib/stores/sessionStore";
import { Button } from "@s3-viewer/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import { Plus, RefreshCcw, Trash, UserRoundPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useBucketContext } from "../Context";

const ObjectActions = () => {
   const { openShareModal, openCreateBucketModal, openConfirmDeleteModal } =
      useModalContext();
   const { gridRef, gridReady } = useGridContext();
   const [rowsSelected, setRowsSelected] = useState<string[]>([]);
   const serverId = useSessionStore((state) => state.serverId);
   const { bucket } = useBucketContext();

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

   return (
      <div className="flex gap-2 @max-3xl/actions:flex-1">
         <Button
            disabled={!gridReady}
            onClick={() => gridRef.current?.api?.refreshInfiniteCache()}
            className="@max-3xl/actions:flex-1"
         >
            <RefreshCcw className="size-4" />
            Refresh
         </Button>
         <Button
            onClick={() => openShareModal({})}
            className="@max-3xl/actions:flex-1"
         >
            <UserRoundPlus className="size-4" />
            Share
         </Button>
         {showDeleteButton ? (
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
         ) : (
            <DropdownMenu>
               <DropdownMenuTrigger asChild>
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
         )}
      </div>
   );
};

export default ObjectActions;
