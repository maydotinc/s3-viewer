import { formatFileSize } from "@/lib/utils/fileUtils";
import { S3Object } from "@s3-viewer/types";
import { ColDef, ValueFormatterParams } from "ag-grid-community";
import FolderCell from "./folder-cell";

const columns: ColDef<S3Object>[] = [
   {
      field: "Key",
      headerName: "Name",
      flex: 2,
      cellRenderer: FolderCell,
      sortable: false,
      filter: "agTextColumnFilter",
      suppressHeaderFilterButton: true,
      suppressHeaderMenuButton: true,
      suppressFiltersToolPanel: true,
   },
   {
      field: "Size",
      headerName: "Size",
      flex: 1,
      sortable: false,
      valueFormatter: (params: ValueFormatterParams) => {
         if (!params.value) {
            return "";
         }
         const { value, unit } = formatFileSize(params.value);
         return `${value} ${unit}`;
      },
   },
   {
      field: "LastModified",
      headerName: "Modified",
      flex: 1,
      valueFormatter: (params: ValueFormatterParams) => {
         if (!params.value) {
            return "";
         }
         return new Date(params.value).toLocaleDateString();
      },
      sortable: false,
   },
];

export default columns;
