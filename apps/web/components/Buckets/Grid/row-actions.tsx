import useObjectCommands from "@/components/Buckets/useObjectCommands";
import { baseName, type S3Object } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import type { ICellRendererParams } from "ag-grid-community";
import { Download, Ellipsis, FilePen, Link2, Trash2 } from "lucide-react";
import type { ObjectGridContext } from "./columns";

const RowActions = (
   params: ICellRendererParams<S3Object, unknown, ObjectGridContext>
) => {
   const { bucketName } = params.context;
   const commands = useObjectCommands(bucketName);
   const data = params.data;
   if (!data) return null;

   const name = baseName(data.key);
   const { can } = commands;
   const folderItems = can.delete;
   const fileItems = can.download || can.rename || can.delete;
   if (data.isFolder ? !folderItems : !fileItems) return null;

   return (
      <div className="flex h-full items-center justify-center">
         <DropdownMenu modal={false}>
            <SimpleTooltip label={`Actions for ${name}`}>
               <DropdownMenuTrigger asChild>
                  <Button
                     variant="ghost"
                     size="icon-sm"
                     aria-label={`Actions for ${name}`}
                  >
                     <Ellipsis aria-hidden="true" />
                  </Button>
               </DropdownMenuTrigger>
            </SimpleTooltip>
            <DropdownMenuContent align="end" className="w-44">
               {data.isFolder ? (
                  <DropdownMenuItem
                     variant="destructive"
                     onSelect={() => commands.remove([data.key])}
                  >
                     <Trash2 aria-hidden="true" />
                     Delete folder
                  </DropdownMenuItem>
               ) : (
                  <>
                     {can.download && (
                        <>
                           <DropdownMenuItem
                              onSelect={() => void commands.download(data.key)}
                           >
                              <Download aria-hidden="true" />
                              Download
                           </DropdownMenuItem>
                           <DropdownMenuItem
                              onSelect={() => void commands.copyLink(data.key)}
                           >
                              <Link2 aria-hidden="true" />
                              Copy link
                           </DropdownMenuItem>
                        </>
                     )}
                     {can.rename && (
                        <DropdownMenuItem
                           onSelect={() => commands.rename(data.key)}
                        >
                           <FilePen aria-hidden="true" />
                           Rename
                        </DropdownMenuItem>
                     )}
                     {can.delete && (
                        <>
                           {(can.download || can.rename) && (
                              <DropdownMenuSeparator />
                           )}
                           <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => commands.remove([data.key])}
                           >
                              <Trash2 aria-hidden="true" />
                              Delete
                           </DropdownMenuItem>
                        </>
                     )}
                  </>
               )}
            </DropdownMenuContent>
         </DropdownMenu>
      </div>
   );
};

export default RowActions;
