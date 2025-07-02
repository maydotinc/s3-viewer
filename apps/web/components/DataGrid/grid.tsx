import { cn } from "@s3-viewer/ui/lib/utils";
import {
   AllCommunityModule,
   ColDef,
   IDatasource,
   ModuleRegistry,
   themeQuartz,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useGridContext } from "./Contexts/grid-context";

ModuleRegistry.registerModules([AllCommunityModule]);

const viewerGridTheme = themeQuartz.withParams({
   accentColor: "var(--color-viewerblue)",
   backgroundColor: "var(--color-viewerwhite)",
   borderColor: "var(--color-viewerborder)",
   borderRadius: 8,
   columnBorder: false,
   fontFamily: "inherit",
   foregroundColor: "var(--color-viewertext)",
   headerBackgroundColor: "var(--color-viewergray)",
   headerFontSize: 14,
   headerRowBorder: false,
   headerVerticalPaddingScale: 0.5,
   rowBorder: true,
   spacing: 12,
   wrapperBorder: false,
   rangeSelectionBorderColor: "transparent",
});

const defaultColDef: ColDef = {
   sortable: true,
   filter: false,
   resizable: false,
};

type BaseGridProps = {
   rowData: any[];
   datasource?: IDatasource;
   colDefs: ColDef<any>[];
   className?: string;
   rowModelType?: "clientSide" | "infinite";
};

const BaseGrid = ({
   rowData,
   datasource,
   colDefs,
   className,
   rowModelType = "clientSide",
}: BaseGridProps) => {
   const { gridRef, pageSize, onGridReady } = useGridContext();

   const rowModelProps =
      rowModelType === "infinite"
         ? {
              rowModelType: "infinite" as const,
              datasource,
              cacheBlockSize: 100,
              cacheOverflowSize: 1,
              maxBlocksInCache: 10,
              blockLoadDebounceMillis: 100,
              pagination: true,
              paginationPageSize: pageSize,
              suppressPaginationPanel: true,
           }
         : {
              rowModelType: "clientSide" as const,
              rowData,
              pagination: true,
              paginationPageSize: pageSize,
              suppressPaginationPanel: true,
           };

   return (
      <div className={cn("w-full flex-1 ag-theme-alpine", className)}>
         <AgGridReact
            ref={gridRef}
            theme={viewerGridTheme}
            defaultColDef={defaultColDef}
            columnDefs={colDefs}
            onGridReady={onGridReady}
            {...rowModelProps}
         />
      </div>
   );
};

export default BaseGrid;
