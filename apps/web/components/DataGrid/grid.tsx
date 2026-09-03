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
   fontSize: 14,
   foregroundColor: "var(--color-viewertext)",
   headerBackgroundColor: "var(--color-viewerwhite)",
   headerFontSize: 14,
   headerFontWeight: 500,
   headerHeight: 40,
   headerRowBorder: true,
   headerTextColor: "var(--color-viewertext)",
   rangeSelectionBorderColor: "transparent",
   rowBorder: true,
   rowHeight: 40,
   rowHoverColor: "var(--color-viewergray)",
   selectedRowBackgroundColor:
      "color-mix(in srgb, var(--color-viewerblue) 6%, transparent)",
   spacing: 8,
   // The card around the grid (GRID_CARD) draws the outer border, so the grid
   // must not draw a second one inside it.
   wrapperBorder: false,
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
