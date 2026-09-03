import { cn } from "@s3-viewer/ui/lib/utils";
import {
   AllCommunityModule,
   ModuleRegistry,
   themeQuartz,
   type ColDef,
   type GetRowIdParams,
   type IDatasource,
   type RowSelectionOptions,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useGridContext } from "./context";
import { LoadingOverlay } from "./overlays";

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
   sortable: false,
   resizable: false,
   filter: false,
   suppressHeaderMenuButton: true,
   suppressMovable: true,
};

type BaseGridProps<TData> = {
   columnDefs: ColDef<TData>[];
   getRowId: (params: GetRowIdParams<TData>) => string;
   noRowsOverlayComponent: React.ComponentType;
   className?: string;
   context?: Record<string, unknown>;
   rowSelection?: RowSelectionOptions<TData>;
} & (
   | { rowModel: "clientSide"; rowData: TData[]; quickFilterText?: string }
   | { rowModel: "infinite"; datasource: IDatasource; cacheBlockSize: number }
);

const BaseGrid = <TData,>(props: BaseGridProps<TData>) => {
   const { gridRef, pageSize, handlers } = useGridContext();
   const {
      columnDefs,
      getRowId,
      noRowsOverlayComponent,
      className,
      context,
      rowSelection,
   } = props;

   const modelProps =
      props.rowModel === "infinite"
         ? {
              rowModelType: "infinite" as const,
              datasource: props.datasource,
              cacheBlockSize: props.cacheBlockSize,
              maxBlocksInCache: 10,
           }
         : {
              rowModelType: "clientSide" as const,
              rowData: props.rowData,
              quickFilterText: props.quickFilterText,
           };

   return (
      <div className={cn("w-full flex-1 min-h-0", className)}>
         <AgGridReact<TData>
            ref={gridRef}
            theme={viewerGridTheme}
            defaultColDef={defaultColDef}
            columnDefs={columnDefs}
            getRowId={getRowId}
            context={context}
            rowSelection={rowSelection}
            pagination
            suppressPaginationPanel
            paginationPageSize={pageSize}
            suppressCellFocus
            noRowsOverlayComponent={noRowsOverlayComponent}
            loadingOverlayComponent={LoadingOverlay}
            onGridReady={handlers.onGridReady}
            onGridPreDestroyed={handlers.onGridPreDestroyed}
            onPaginationChanged={handlers.onPaginationChanged}
            onSelectionChanged={handlers.onSelectionChanged}
            {...modelProps}
         />
      </div>
   );
};

export default BaseGrid;
