import { cn } from "@s3-viewer/ui/lib/utils";
import {
   AllCommunityModule,
   ColDef,
   ModuleRegistry,
   RowSelectionOptions,
   themeQuartz,
   ValidationModule,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useGridContext } from "./context";
import { LoaderCircle } from "lucide-react";
ModuleRegistry.registerModules([AllCommunityModule, ValidationModule]);

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
   resizable: false,
   filter: false,
};

type BaseGridProps = {
   colDefs: ColDef<any>[];
   className?: string;
   rowModel: {
      type: "clientSide" | "infinite";
      cacheBlockSize?: number;
      cacheOverflowSize?: number;
      maxBlocksInCache?: number;
      blockLoadDebounceMillis?: number;
   };
   noRowsOverlayComponent?: React.ComponentType<any>;
   routeContext?: {
      bucketName: string;
      path: string[];
   };
   rowSelection?: RowSelectionOptions;
};

const BaseGrid = ({
   colDefs,
   className,
   rowModel,
   noRowsOverlayComponent,
   routeContext,
   rowSelection,
}: BaseGridProps) => {
   const { gridRef, pageSize, onGridReady, onGridDestroy } = useGridContext();

   const rowModelProps =
      rowModel.type === "infinite"
         ? {
              rowModelType: "infinite" as const,
              cacheBlockSize: rowModel.cacheBlockSize,
              cacheOverflowSize: rowModel.cacheOverflowSize,
              maxBlocksInCache: rowModel.maxBlocksInCache,
              blockLoadDebounceMillis: rowModel.blockLoadDebounceMillis,
           }
         : {
              rowModelType: "clientSide" as const,
           };

   const loadingOverlayComponent = () => {
      return (
         <div className="flex flex-col items-center justify-center h-full">
            <LoaderCircle className="animate-spin" />
         </div>
      );
   };

   return (
      <div className={cn("w-full flex-1 ag-theme-alpine", className)}>
         <AgGridReact
            ref={gridRef}
            theme={viewerGridTheme}
            defaultColDef={defaultColDef}
            columnDefs={colDefs}
            onGridReady={onGridReady}
            onGridPreDestroyed={onGridDestroy}
            pagination={true}
            suppressPaginationPanel={true}
            paginationPageSize={pageSize}
            noRowsOverlayComponent={noRowsOverlayComponent}
            loadingOverlayComponent={loadingOverlayComponent}
            context={routeContext}
            rowSelection={rowSelection}
            {...rowModelProps}
         />
      </div>
   );
};

export default BaseGrid;
