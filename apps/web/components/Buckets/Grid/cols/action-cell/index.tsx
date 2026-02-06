import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import { ICellRendererParams } from "ag-grid-community";
import { EllipsisVertical, Loader2 } from "lucide-react";
import { useState } from "react";
import DeleteObject from "./delete";
import DownloadObject from "./download";

const ActionCell = (params: ICellRendererParams) => {
   const [isLoading, setIsLoading] = useState(false);
   const fileName = params.data?.Key;
   if (fileName === undefined || fileName.endsWith("/")) {
      return <></>;
   }

   if (isLoading) {
      return (
         <div className="flex items-center justify-end size-full pr-5">
            <Loader2 className="size-5 text-inherit animate-spin" />
         </div>
      );
   }

   return (
      <div className="flex items-center justify-end size-full pr-5">
         <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="cursor-pointer hover:text-viewerblue">
               <EllipsisVertical className="size-5 text-inherit" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-50 p-2">
               <DownloadObject params={params} setIsLoading={setIsLoading} />
               <DropdownMenuSeparator className="mx-auto" />
               <DeleteObject params={params} />
            </DropdownMenuContent>
         </DropdownMenu>
      </div>
   );
};

export default ActionCell;
