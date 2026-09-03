import RemoveBucketDialog from "@/components/Buckets/remove-bucket-dialog";
import { HIDDEN_HEADER_TEXT } from "@/components/DataGrid/context";
import { usePermission } from "@/lib/hooks/usePermission";
import { formatDate } from "@/lib/utils/format";
import { folderHref } from "@/lib/utils/s3/paths";
import { Permission, ROLE_LABELS } from "@s3-viewer/permissions";
import type { S3Bucket } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import type {
   ColDef,
   GetRowIdParams,
   ICellRendererParams,
} from "ag-grid-community";
import { EllipsisVertical, Folder, FolderMinus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const BucketNameCell = (params: ICellRendererParams<S3Bucket, string>) => {
   const data = params.data;
   if (!data) return null;
   return (
      <Link
         href={folderHref(data.name, [])}
         className="flex h-full min-w-0 items-center gap-2 text-viewertext hover:text-viewerblue focus-visible:text-viewerblue"
      >
         <Folder
            className="size-4 shrink-0 text-viewerblue"
            aria-hidden="true"
         />
         <span className="truncate">{data.name}</span>
      </Link>
   );
};

const BucketRowActions = (params: ICellRendererParams<S3Bucket>) => {
   const canRemove = usePermission(Permission.DELETE_BUCKET);
   const [confirming, setConfirming] = useState(false);
   const data = params.data;
   if (!data || !canRemove) return null;

   return (
      <div className="flex h-full items-center justify-end pr-1">
         <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
               <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Actions for ${data.name}`}
               >
                  <EllipsisVertical aria-hidden="true" />
               </Button>
            </DropdownMenuTrigger>
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
            bucketName={data.name}
            open={confirming}
            onOpenChange={setConfirming}
         />
      </div>
   );
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
      cellStyle: { paddingLeft: "4px" },
      headerStyle: { paddingLeft: "4px" },
   },
   {
      colId: "created",
      headerName: "Created",
      width: 200,
      valueGetter: (params) => params.data?.creationDate,
      valueFormatter: (params) => formatDate(params.data?.creationDate),
      getQuickFilterText: () => "",
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
      width: 56,
      cellRenderer: BucketRowActions,
      cellStyle: { padding: 0 },
      getQuickFilterText: () => "",
   },
];

const bucketRowId = (params: GetRowIdParams<S3Bucket>) => params.data.name;

export { bucketColumns, bucketRowId };
