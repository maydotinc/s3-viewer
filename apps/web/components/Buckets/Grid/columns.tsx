import {
   HIDDEN_HEADER_TEXT,
   RIGHT_ALIGNED,
} from "@/components/DataGrid/context";
import { CellBar, nameBarWidth } from "@/components/DataGrid/skeleton";
import { formatBytes, formatDate } from "@/lib/utils/format";
import { folderHref, objectHref, segmentsFromKey } from "@/lib/utils/s3/paths";
import type { S3Object } from "@s3-viewer/types";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import type {
   ColDef,
   GetRowIdParams,
   ICellRendererParams,
} from "ag-grid-community";
import { cn } from "@s3-viewer/ui/lib/utils";
import { File, Folder } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import RowActions from "./row-actions";
import { selectionColumn } from "./selection";

type ObjectGridContext = { bucketName: string; prefix: string };

/**
 * A cell of a row the infinite model hasn't fetched yet. AG Grid gives it no
 * height of its own, so the bar has to be centred in the 44px row here
 * (DESIGN.md §3) — a bare `Skeleton` sits against the top edge.
 */
const PendingCell = ({
   children,
   align = "left",
}: {
   children: ReactNode;
   align?: "left" | "right";
}) => (
   <div
      className={cn(
         "flex h-full items-center gap-2.5",
         align === "right" && "justify-end"
      )}
   >
      {children}
   </div>
);

const NameCell = (
   params: ICellRendererParams<S3Object, string, ObjectGridContext>
) => {
   const data = params.data;
   // The loaded cell is icon + label, so the placeholder is a square + a bar.
   if (!data)
      return (
         <PendingCell>
            <Skeleton className="size-4 shrink-0 rounded" />
            <CellBar className={nameBarWidth(params.node.rowIndex ?? 0)} />
         </PendingCell>
      );

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

/**
 * A right-aligned value column: its formatted text once the block lands, a bar
 * of the same weight until then, so the whole row loads as one line of text.
 */
const pendingBarCell = (width: string) => {
   const ValueCell = (params: ICellRendererParams<S3Object>) =>
      params.data ? (
         <>{params.valueFormatted}</>
      ) : (
         <PendingCell align="right">
            <CellBar className={width} />
         </PendingCell>
      );
   ValueCell.displayName = "ValueCell";
   return ValueCell;
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
      cellRenderer: pendingBarCell("w-12"),
      ...RIGHT_ALIGNED,
   },
   {
      colId: "modified",
      headerName: "Modified",
      width: 200,
      valueGetter: (params) => params.data?.lastModified,
      valueFormatter: (params) =>
         params.data ? formatDate(params.data.lastModified) : "",
      cellRenderer: pendingBarCell("w-24"),
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
