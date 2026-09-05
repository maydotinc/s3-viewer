import { cn } from "@s3-viewer/ui/lib/utils";
import {
   CellStyleModule,
   ClientSideRowModelModule,
   EventApiModule,
   InfiniteRowModelModule,
   ModuleRegistry,
   PaginationModule,
   QuickFilterModule,
   RowApiModule,
   RowSelectionModule,
   ValidationModule,
   themeQuartz,
   type ColDef,
   type GetRowIdParams,
   type IDatasource,
   type RowSelectionOptions,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useGridPaginationContext } from "./context";
import { LoadingOverlay } from "./overlays";
import { SKELETON_ROWS } from "./skeleton";

// overlays, theming, headers and cell renderers need no entry here: they are
// part of the always-registered community core.
ModuleRegistry.registerModules([
   ClientSideRowModelModule,
   InfiniteRowModelModule,
   PaginationModule,
   RowSelectionModule,
   QuickFilterModule,
   CellStyleModule,
   EventApiModule,
   RowApiModule,
   ...(process.env.NODE_ENV === "production" ? [] : [ValidationModule]),
]);

const viewerGridTheme = themeQuartz.withParams({
   accentColor: "var(--color-viewerblue)",
   backgroundColor: "var(--color-viewerwhite)",
   borderColor: "var(--color-viewerborder)",
   borderRadius: 12,
   cellHorizontalPadding: 16,
   columnBorder: false,
   fontFamily: "inherit",
   fontSize: 14,
   foregroundColor: "var(--color-viewerblack)",
   headerBackgroundColor:
      "color-mix(in srgb, var(--color-viewergray) 60%, var(--color-viewerwhite))",
   headerFontSize: 13,
   headerFontWeight: 500,
   headerHeight: 44,
   headerRowBorder: true,
   headerTextColor: "var(--color-viewertext)",
   rangeSelectionBorderColor: "transparent",
   rowBorder: true,
   rowHeight: 44,
   rowHoverColor:
      "color-mix(in srgb, var(--color-viewergray) 60%, var(--color-viewerwhite))",
   selectedRowBackgroundColor:
      "color-mix(in srgb, var(--color-viewerblue) 5%, transparent)",
   spacing: 8,
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
   const { gridRef, pageSize, handlers } = useGridPaginationContext();
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
              // ag grid defaults to 1, stranding a lone skeleton row in an
              // empty card.
              infiniteInitialRowCount: SKELETON_ROWS,
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
            loadingOverlayComponentParams={{ columns: columnDefs }}
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
export type { BaseGridProps };
