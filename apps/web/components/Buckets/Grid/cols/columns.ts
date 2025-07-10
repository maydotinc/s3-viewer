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
         if (params.value < 1024) {
            return `${params.value} B`;
         } else if (params.value < 1024 * 1024) {
            return `${(params.value / 1024).toFixed(2)} KB`;
         } else if (params.value < 1024 * 1024 * 1024) {
            return `${(params.value / 1024 / 1024).toFixed(2)} MB`;
         } else if (params.value < 1024 * 1024 * 1024 * 1024) {
            return `${(params.value / 1024 / 1024 / 1024).toFixed(2)} GB`;
         }
         return `${(params.value / 1024 / 1024 / 1024 / 1024).toFixed(2)} TB`;
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
