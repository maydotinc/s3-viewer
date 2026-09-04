import RemoveBucketDialog from "@/components/Buckets/remove-bucket-dialog";
import {
   HIDDEN_HEADER_TEXT,
   RIGHT_ALIGNED,
} from "@/components/DataGrid/context";
import { formatDate } from "@/lib/utils/format";
import { folderHref } from "@/lib/utils/s3/paths";
import { ROLE_LABELS } from "@s3-viewer/permissions";
import type { S3Bucket } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import type {
   ColDef,
   GetRowIdParams,
   ICellRendererParams,
} from "ag-grid-community";
import { Ellipsis, Folder, FolderMinus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const BucketNameCell = (params: ICellRendererParams<S3Bucket, string>) => {
   const data = params.data;
   if (!data) return null;
   return (
      <Link
         href={folderHref(data.name, [])}
         className="flex h-full min-w-0 items-center gap-2.5 text-viewerblack transition-colors hover:text-viewerblue focus-visible:text-viewerblue"
      >
         <Folder
            className="size-4 shrink-0 text-viewertext"
            aria-hidden="true"
         />
         <span className="truncate">{data.name}</span>
      </Link>
   );
};

type BucketGridContext = { canRemove: boolean };

const BucketActionsMenu = ({ bucketName }: { bucketName: string }) => {
   const [confirming, setConfirming] = useState(false);

   return (
      <div className="flex h-full items-center justify-center">
         <DropdownMenu modal={false}>
            <SimpleTooltip label={`Actions for ${bucketName}`}>
               <DropdownMenuTrigger asChild>
                  <Button
                     variant="ghost"
                     size="icon-sm"
                     aria-label={`Actions for ${bucketName}`}
                  >
                     <Ellipsis aria-hidden="true" />
                  </Button>
               </DropdownMenuTrigger>
            </SimpleTooltip>
            <DropdownMenuContent align="end" className="w-44">
               <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setConfirming(true)}
               >
                  <FolderMinus aria-hidden="true" />
                  Remove bucket
               </DropdownMenuItem>
            </DropdownMenuContent>
         </DropdownMenu>
         <RemoveBucketDialog
            bucketName={bucketName}
            open={confirming}
            onOpenChange={setConfirming}
         />
      </div>
   );
};

const BucketRowActions = (
   params: ICellRendererParams<S3Bucket, unknown, BucketGridContext>
) => {
   const data = params.data;
   if (!data) return null;
   return params.context.canRemove ? (
      <BucketActionsMenu bucketName={data.name} />
   ) : null;
};

const bucketColumns: ColDef<S3Bucket>[] = [
   {
      colId: "name",
      headerName: "Name",
      flex: 3,
      minWidth: 200,
      valueGetter: (params) => params.data?.name,
      cellRenderer: BucketNameCell,
      getQuickFilterText: (params) => params.data.name,
   },
   {
      colId: "created",
      headerName: "Created",
      width: 200,
      valueGetter: (params) => params.data?.creationDate,
      valueFormatter: (params) => formatDate(params.data?.creationDate),
      getQuickFilterText: () => "",
      ...RIGHT_ALIGNED,
   },
   {
      colId: "role",
      headerName: "Your role",
      width: 120,
      valueGetter: (params) => params.data?.userRole,
      valueFormatter: (params) =>
         params.data ? ROLE_LABELS[params.data.userRole] : "",
      getQuickFilterText: () => "",
   },
   {
      colId: "actions",
      headerName: "Actions",
      headerClass: HIDDEN_HEADER_TEXT,
      width: 64,
      cellRenderer: BucketRowActions,
      cellStyle: { padding: 0 },
      getQuickFilterText: () => "",
   },
];

const bucketRowId = (params: GetRowIdParams<S3Bucket>) => params.data.name;

export { bucketColumns, bucketRowId };
export type { BucketGridContext };
