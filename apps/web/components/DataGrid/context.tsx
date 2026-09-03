import type {
   GridReadyEvent,
   PaginationChangedEvent,
   SelectionChangedEvent,
} from "ag-grid-community";
import type { AgGridReact } from "ag-grid-react";
import {
   createContext,
   useCallback,
   useContext,
   useMemo,
   useRef,
   useState,
} from "react";

const PAGE_SIZES = [25, 50, 100] as const;

const HIDDEN_HEADER_TEXT = "[&_.ag-header-cell-text]:sr-only";

/** The grid and its pagination bar live inside one bordered card. */
const GRID_CARD =
   "flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg border border-viewerborder bg-viewerwhite";

type GridContextValue = {
   gridRef: React.RefObject<AgGridReact | null>;
   gridReady: boolean;
   pageSize: number;
   setPageSize: (size: number) => void;
   page: number;
   totalPages: number | null;
   rowCount: number;
   selectedIds: string[];
   goToPage: (page: number) => void;
   clearSelection: () => void;
   handlers: {
      onGridReady: (event: GridReadyEvent) => void;
      onGridPreDestroyed: () => void;
      onPaginationChanged: (event: PaginationChangedEvent) => void;
      onSelectionChanged: (event: SelectionChangedEvent) => void;
   };
};

const GridContext = createContext<GridContextValue | null>(null);

const GridProvider = ({ children }: { children: React.ReactNode }) => {
   const gridRef = useRef<AgGridReact>(null);
   const [gridReady, setGridReady] = useState(false);
   const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[2]);
   const [page, setPage] = useState(0);
   const [totalPages, setTotalPages] = useState<number | null>(null);
   const [rowCount, setRowCount] = useState(0);
   const [selectedIds, setSelectedIds] = useState<string[]>([]);

   const onGridReady = useCallback(() => setGridReady(true), []);

   const onGridPreDestroyed = useCallback(() => {
      setGridReady(false);
      setPage(0);
      setTotalPages(null);
      setRowCount(0);
      setSelectedIds([]);
   }, []);

   const onPaginationChanged = useCallback((event: PaginationChangedEvent) => {
      const { api } = event;
      setPage(api.paginationGetCurrentPage());
      setTotalPages(
         api.paginationIsLastPageFound() ? api.paginationGetTotalPages() : null
      );
      setRowCount(api.paginationGetRowCount());
   }, []);

   const onSelectionChanged = useCallback((event: SelectionChangedEvent) => {
      setSelectedIds(
         event.api
            .getSelectedNodes()
            .map((node) => node.id)
            .filter((id): id is string => typeof id === "string")
      );
   }, []);

   const goToPage = useCallback((target: number) => {
      gridRef.current?.api?.paginationGoToPage(Math.max(0, target));
   }, []);

   const clearSelection = useCallback(() => {
      gridRef.current?.api?.deselectAll();
   }, []);

   const value = useMemo<GridContextValue>(
      () => ({
         gridRef,
         gridReady,
         pageSize,
         setPageSize,
         page,
         totalPages,
         rowCount,
         selectedIds,
         goToPage,
         clearSelection,
         handlers: {
            onGridReady,
            onGridPreDestroyed,
            onPaginationChanged,
            onSelectionChanged,
         },
      }),
      [
         gridReady,
         pageSize,
         page,
         totalPages,
         rowCount,
         selectedIds,
         goToPage,
         clearSelection,
         onGridReady,
         onGridPreDestroyed,
         onPaginationChanged,
         onSelectionChanged,
      ]
   );

   return <GridContext.Provider value={value}>{children}</GridContext.Provider>;
};

const useGridContext = () => {
   const context = useContext(GridContext);
   if (!context)
      throw new Error("useGridContext must be used within a GridProvider");
   return context;
};

export {
   GRID_CARD,
   GridProvider,
   HIDDEN_HEADER_TEXT,
   PAGE_SIZES,
   useGridContext,
};
