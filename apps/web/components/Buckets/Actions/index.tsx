import UploadFile from "@/components/Buckets/Actions/upload-file";
import { useGridContext } from "@/components/DataGrid/context";
import { useModalContext } from "@/lib/contexts/ModalContext";
import { Button } from "@s3-viewer/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import { Folder, Plus, RefreshCcw, UserRoundPlus } from "lucide-react";

const ObjectActions = () => {
   const { openShareModal, openCreateBucketModal } = useModalContext();
   const { gridRef, gridReady } = useGridContext();

   return (
      <div className="flex gap-2">
         <Button
            disabled={!gridReady}
            onClick={() => gridRef.current?.api?.refreshInfiniteCache()}
         >
            <RefreshCcw className="size-4" />
            Refresh
         </Button>
         <Button onClick={() => openShareModal({})}>
            <UserRoundPlus className="size-4" />
            Share
         </Button>
         <DropdownMenu>
            <DropdownMenuTrigger asChild>
               <Button
                  variant="secondary"
                  onClick={() => openCreateBucketModal({})}
               >
                  <Plus className="size-4" />
                  New
               </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-50">
               <DropdownMenuItem className="flex items-center gap-2 cursor-pointer size-full">
                  <Folder className="size-4 text-inherit" />
                  Upload Folder
               </DropdownMenuItem>
               <UploadFile />
            </DropdownMenuContent>
         </DropdownMenu>
      </div>
   );
};

export default ObjectActions;
