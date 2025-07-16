import { formatFileSize } from "@/lib/utils/fileUtils";
import { S3Object } from "@s3-viewer/types";
import { ColDef, ValueFormatterParams } from "ag-grid-community";
import ActionsCell from "./action-cell";
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
   {
      headerName: "",
      flex: 0.5,
      sortable: false,
      cellRenderer: ActionsCell,
      cellStyle: {
         paddingRight: "0px",
         paddingLeft: "0px",
      },
   },
];

export default columns;
