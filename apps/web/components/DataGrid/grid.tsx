import { cn } from "@s3-viewer/ui/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
   type GridApi,
   type GridReadyEvent,
   type GridSizeChangedEvent,
   type IDatasource,
   type RowSelectionOptions,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useGridPaginationContext } from "./context";
import { hiddenColumnIds, withHiddenColumns } from "./fit-columns";
import { LoadingOverlay } from "./overlays";
import { FittedGridSkeleton, SKELETON_ROWS } from "./skeleton";

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

type GridProps<TData> = {
   columnDefs: ColDef<TData>[];
   getRowId: (params: GetRowIdParams<TData>) => string;
   noRowsOverlayComponent: React.ComponentType;
   rowSelection?: RowSelectionOptions<TData>;
} & (
   | { rowModel: "clientSide"; rowData: TData[]; quickFilterText?: string }
   | {
        rowModel: "infinite";
        createDatasource: (api: GridApi<TData>) => IDatasource;
        cacheBlockSize: number;
     }
);

const Grid = <TData,>(props: GridProps<TData>) => {
   const { gridRef, pageSize, handlers } = useGridPaginationContext();
   const [layoutReady, setLayoutReady] = useState(false);
   const [hiddenColumns, setHiddenColumns] = useState<readonly string[]>([]);
   const revealed = useRef(false);
   const measured = useRef(false);
   const layoutFrame = useRef<number | null>(null);
   const revealAfterLayout = useCallback(() => {
      if (revealed.current || !measured.current) return;
      if (layoutFrame.current !== null)
         cancelAnimationFrame(layoutFrame.current);
      // AG Grid measures, then applies flex widths; stay hidden until both passes paint.
      layoutFrame.current = requestAnimationFrame(() => {
         layoutFrame.current = requestAnimationFrame(() => {
            layoutFrame.current = null;
            revealed.current = true;
            setLayoutReady(true);
         });
      });
   }, []);
   useEffect(
      () => () => {
         if (layoutFrame.current !== null)
            cancelAnimationFrame(layoutFrame.current);
      },
      []
   );
   const { columnDefs, getRowId, noRowsOverlayComponent, rowSelection } = props;
   const fittedColumns = useMemo(
      () => withHiddenColumns(columnDefs, hiddenColumns),
      [columnDefs, hiddenColumns]
   );
   const overlayParams = useMemo(
      () => ({ columns: fittedColumns }),
      [fittedColumns]
   );
   const createDatasource =
      props.rowModel === "infinite" ? props.createDatasource : undefined;
   const notifyGridReady = handlers.onGridReady;
   const onGridReady = useCallback(
      (event: GridReadyEvent<TData>) => {
         if (event.api.isDestroyed()) return;
         if (createDatasource)
            event.api.setGridOption("datasource", createDatasource(event.api));
         notifyGridReady(event);
      },
      [createDatasource, notifyGridReady]
   );
   const onGridSizeChanged = useCallback(
      (event: GridSizeChangedEvent<TData>) => {
         if (event.clientWidth <= 0 || event.clientHeight <= 0) return;
         const next = hiddenColumnIds(columnDefs, event.clientWidth);
         setHiddenColumns((previous) =>
            previous.join("\n") === next.join("\n") ? previous : next
         );
         measured.current = true;
         revealAfterLayout();
      },
      [columnDefs, revealAfterLayout]
   );

   const modelProps =
      props.rowModel === "infinite"
         ? {
              rowModelType: "infinite" as const,
              cacheBlockSize: props.cacheBlockSize,
              maxBlocksInCache: 10,
              infiniteInitialRowCount: SKELETON_ROWS,
           }
         : {
              rowModelType: "clientSide" as const,
              rowData: props.rowData,
              quickFilterText: props.quickFilterText,
           };

   return (
      <div
         className="relative w-full min-w-0 flex-1 min-h-0 overflow-hidden"
         aria-busy={!layoutReady || undefined}
      >
         {/* AG Grid adds its theme class imperatively; only change our wrapper. */}
         <div className={cn("size-full", !layoutReady && "invisible")}>
            <AgGridReact<TData>
               className="size-full"
               ref={gridRef}
               theme={viewerGridTheme}
               defaultColDef={defaultColDef}
               columnDefs={fittedColumns}
               getRowId={getRowId}
               rowSelection={rowSelection}
               pagination
               suppressPaginationPanel
               paginationPageSize={pageSize}
               suppressCellFocus
               noRowsOverlayComponent={noRowsOverlayComponent}
               loadingOverlayComponent={LoadingOverlay}
               loadingOverlayComponentParams={overlayParams}
               onGridReady={onGridReady}
               onGridPreDestroyed={handlers.onGridPreDestroyed}
               onGridSizeChanged={onGridSizeChanged}
               onColumnResized={revealAfterLayout}
               onPaginationChanged={handlers.onPaginationChanged}
               onSelectionChanged={handlers.onSelectionChanged}
               {...modelProps}
            />
         </div>
         {!layoutReady && (
            <FittedGridSkeleton
               columns={columnDefs as readonly ColDef[]}
               className="absolute inset-0"
            />
         )}
      </div>
   );
};

export default Grid;
export type { GridProps };
