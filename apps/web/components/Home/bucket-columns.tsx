import FoldersOnlyLabel from "@/components/folders-only-label";
import RemoveBucketDialog from "@/components/Buckets/remove-bucket-dialog";
import OverflowMenu from "@/components/overflow-menu";
import {
   HIDDEN_HEADER_TEXT,
   RIGHT_ALIGNED,
} from "@/components/DataGrid/context";
import { formatDate } from "@/lib/utils/format";
import useServerInfo from "@/lib/hooks/queries/server/useServerInfo";
import { canRemoveBucket } from "@/lib/hooks/usePermission";
import { useServerId } from "@/lib/stores/session-scope";
import { bucketEntryHref } from "@/lib/utils/s3/paths";
import { ROLE_LABELS } from "@s3-viewer/permissions";
import type { S3Bucket } from "@s3-viewer/types";
import { Badge } from "@s3-viewer/ui/components/badge";
import { DropdownMenuItem } from "@s3-viewer/ui/components/dropdown-menu";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import type {
   ColDef,
   GetRowIdParams,
   ICellRendererParams,
} from "ag-grid-community";
import type { FitContext } from "@/components/DataGrid/fit-columns";
import { Folder, FolderMinus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const BucketNameCell = (params: ICellRendererParams<S3Bucket, string>) => {
   const serverId = useServerId();
   const data = params.data;
   if (!data) return null;
   const link = (
      <Link
         href={bucketEntryHref(serverId, data)}
         className="flex h-full min-w-0 items-center gap-2.5 text-viewerblack transition-colors hover:text-viewerblue focus-visible:text-viewerblue"
      >
         <Folder
            className="size-4 shrink-0 text-viewertext"
            aria-hidden="true"
         />
         <span className="truncate" title={data.name}>
            {data.name}
         </span>
      </Link>
   );
   if (data.folders === null) return link;
   return (
      <div className="flex h-full min-w-0 items-center gap-2">
         {link}
         <SimpleTooltip label={<FoldersOnlyLabel folders={data.folders} />}>
            <Badge tabIndex={0}>Folders only</Badge>
         </SimpleTooltip>
      </div>
   );
};

const BucketActionsMenu = ({ bucketName }: { bucketName: string }) => {
   const [confirming, setConfirming] = useState(false);

   return (
      <div className="flex h-full items-center justify-center">
         <OverflowMenu label={bucketName}>
            <DropdownMenuItem
               variant="destructive"
               onSelect={() => setConfirming(true)}
            >
               <FolderMinus aria-hidden="true" />
               Remove bucket
            </DropdownMenuItem>
         </OverflowMenu>
         <RemoveBucketDialog
            bucketName={bucketName}
            open={confirming}
            onOpenChange={setConfirming}
         />
      </div>
   );
};

const BucketRowActions = (params: ICellRendererParams<S3Bucket>) => {
   const { data: server } = useServerInfo(useServerId());
   const data = params.data;
   if (!data) return null;
   return canRemoveBucket(server, data) ? (
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
      context: { dropOrder: 1 } satisfies FitContext,
      valueGetter: (params) => params.data?.creationDate,
      valueFormatter: (params) => formatDate(params.data?.creationDate),
      getQuickFilterText: () => "",
      ...RIGHT_ALIGNED,
   },
   {
      colId: "role",
      headerName: "Your role",
      width: 120,
      context: { dropOrder: 2 } satisfies FitContext,
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
