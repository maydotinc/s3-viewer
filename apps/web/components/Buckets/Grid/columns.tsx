import {
   HIDDEN_HEADER_TEXT,
   RIGHT_ALIGNED,
} from "@/components/DataGrid/context";
import { formatBytes, formatDate } from "@/lib/utils/format";
import { folderHref, objectHref, segmentsFromKey } from "@/lib/utils/s3/paths";
import type { S3Object } from "@s3-viewer/types";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import type {
   ColDef,
   GetRowIdParams,
   ICellRendererParams,
} from "ag-grid-community";
import { File, Folder } from "lucide-react";
import Link from "next/link";
import RowActions from "./row-actions";
import { selectionColumn } from "./selection";

type ObjectGridContext = { bucketName: string; prefix: string };

const NameCell = (
   params: ICellRendererParams<S3Object, string, ObjectGridContext>
) => {
   const data = params.data;
   if (!data) return <Skeleton className="my-auto h-4 w-48" />;

   const { bucketName, prefix } = params.context;
   const label = data.key.startsWith(prefix)
      ? data.key.slice(prefix.length)
      : data.key;
   const href = data.isFolder
      ? folderHref(bucketName, segmentsFromKey(data.key))
      : objectHref(bucketName, data.key);
   const Icon = data.isFolder ? Folder : File;

   return (
      <Link
         href={href}
         className="flex h-full min-w-0 items-center gap-2.5 text-viewerblack transition-colors hover:text-viewerblue focus-visible:text-viewerblue"
      >
         <Icon className="size-4 shrink-0 text-viewertext" aria-hidden="true" />
         <span className="truncate">{label}</span>
      </Link>
   );
};

const objectColumns: ColDef<S3Object>[] = [
   selectionColumn,
   {
      colId: "name",
      headerName: "Name",
      flex: 3,
      minWidth: 240,
      valueGetter: (params) => params.data?.key,
      cellRenderer: NameCell,
   },
   {
      colId: "size",
      headerName: "Size",
      width: 120,
      valueGetter: (params) => params.data?.size,
      valueFormatter: (params) =>
         !params.data
            ? ""
            : params.data.isFolder
              ? "—"
              : formatBytes(params.data.size),
      ...RIGHT_ALIGNED,
   },
   {
      colId: "modified",
      headerName: "Modified",
      width: 200,
      valueGetter: (params) => params.data?.lastModified,
      valueFormatter: (params) =>
         params.data ? formatDate(params.data.lastModified) : "",
      ...RIGHT_ALIGNED,
   },
   {
      colId: "actions",
      headerName: "Actions",
      headerClass: HIDDEN_HEADER_TEXT,
      width: 64,
      cellRenderer: RowActions,
      cellStyle: { padding: 0 },
   },
];

const objectRowId = (params: GetRowIdParams<S3Object>) => params.data.key;

export { objectColumns, objectRowId };
export type { ObjectGridContext };
