import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import { ICellRendererParams } from "ag-grid-community";
import {
   Download,
   EllipsisVertical,
   Pencil,
   Replace,
   Trash2,
} from "lucide-react";

const ActionsCell = (params: ICellRendererParams) => {
   const fileName = params.data?.Key;
   if (fileName === undefined || fileName.endsWith("/")) {
      return <></>;
   }

   return (
      <div className="flex items-center justify-end size-full pr-5">
         <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="cursor-pointer hover:text-viewerblue">
               <EllipsisVertical className="size-5 text-inherit" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-50 p-2">
               <DropdownMenuItem>
                  <Download className="size-4 text-inherit" />
                  Download
               </DropdownMenuItem>
               <DropdownMenuItem>
                  <Pencil className="size-4 text-inherit" />
                  Rename
               </DropdownMenuItem>
               <DropdownMenuItem>
                  <Replace className="size-4 text-inherit" />
                  Move
               </DropdownMenuItem>
               <DropdownMenuSeparator className="mx-auto" />
               <DropdownMenuItem variant="destructive">
                  <Trash2 className="size-4 text-inherit" />
                  Delete
               </DropdownMenuItem>
            </DropdownMenuContent>
         </DropdownMenu>
      </div>
   );
};

export default ActionsCell;
