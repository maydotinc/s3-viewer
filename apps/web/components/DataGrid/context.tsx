import type { S3Object } from "@s3-viewer/types";
import type {
   GridApi,
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

const RIGHT_ALIGNED = {
   cellClass: "ag-right-aligned-cell tabular-nums",
   headerClass: "ag-right-aligned-header",
} as const;

const GRID_CARD =
   "flex min-h-48 min-w-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-viewerborder bg-viewerwhite";

type GridPaginationContextValue = {
   gridRef: React.RefObject<AgGridReact | null>;
   gridReady: boolean;
   pageSize: number;
   setPageSize: (size: number) => void;
   page: number;
   totalPages: number | null;
   rowCount: number;
   goToPage: (page: number) => void;
   clearSelection: () => void;
   refreshSnapshots: (api: GridApi) => void;
   handlers: {
      onGridReady: (event: GridReadyEvent) => void;
      onGridPreDestroyed: () => void;
      onPaginationChanged: (event: PaginationChangedEvent) => void;
      onSelectionChanged: (event: SelectionChangedEvent) => void;
   };
};

type SelectedObject = Pick<S3Object, "key" | "eTag" | "size">;

const snapshotOf = ({ key, eTag, size }: S3Object): SelectedObject => ({
   key,
   eTag,
   size,
});

type SelectionContextValue = {
   selectedObjects: ReadonlyMap<string, SelectedObject | null>;
   selectedIds: string[];
   selectedIdSet: ReadonlySet<string>;
};

type GridContextValue = GridPaginationContextValue & SelectionContextValue;

const GridPaginationContext = createContext<GridPaginationContextValue | null>(
   null
);
const SelectionContext = createContext<SelectionContextValue | null>(null);

const GridProvider = ({ children }: { children: React.ReactNode }) => {
   const gridRef = useRef<AgGridReact>(null);
   const [gridReady, setGridReady] = useState(false);
   const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[2]);
   const [page, setPage] = useState(0);
   const [totalPages, setTotalPages] = useState<number | null>(null);
   const [rowCount, setRowCount] = useState(0);
   const [selectedObjects, setSelectedObjects] = useState<
      ReadonlyMap<string, SelectedObject | null>
   >(new Map());
   const selectedIds = useMemo(
      () => [...selectedObjects.keys()],
      [selectedObjects]
   );

   const onGridReady = useCallback(() => setGridReady(true), []);

   const onGridPreDestroyed = useCallback(() => {
      setGridReady(false);
      setPage(0);
      setTotalPages(null);
      setRowCount(0);
      setSelectedObjects(new Map());
   }, []);

   const onPaginationChanged = useCallback((event: PaginationChangedEvent) => {
      const { api } = event;
      setPage(api.paginationGetCurrentPage());
      setTotalPages(
         api.paginationIsLastPageFound() ? api.paginationGetTotalPages() : null
      );
      setRowCount(api.paginationGetRowCount());
   }, []);

   const onSelectionChanged = useCallback(
      (event: SelectionChangedEvent<S3Object>) => {
         const nodes = event.api.getSelectedNodes();
         setSelectedObjects(
            (previous) =>
               new Map(
                  nodes.flatMap(({ id, data }) => {
                     if (typeof id !== "string") return [];
                     const snapshot = previous.has(id)
                        ? (previous.get(id) ?? null)
                        : data
                          ? snapshotOf(data)
                          : null;
                     return [[id, snapshot]];
                  })
               )
         );
      },
      []
   );

   const goToPage = useCallback((target: number) => {
      gridRef.current?.api?.paginationGoToPage(Math.max(0, target));
   }, []);

   const clearSelection = useCallback(() => {
      setSelectedObjects(new Map());
      gridRef.current?.api?.deselectAll();
   }, []);

   // after a listing reload the rows on screen are the versions the user now sees, so selected rows follow them
   const refreshSnapshots = useCallback((api: GridApi) => {
      const current = new Map<string, S3Object>();
      for (const { id, data } of api.getSelectedNodes())
         if (typeof id === "string" && data) current.set(id, data as S3Object);
      setSelectedObjects((previous) => {
         let next: Map<string, SelectedObject | null> | null = null;
         for (const [id, snapshot] of previous) {
            const data = current.get(id);
            if (!data || (snapshot && snapshot.eTag === data.eTag)) continue;
            next ??= new Map(previous);
            next.set(id, snapshotOf(data));
         }
         return next ?? previous;
      });
   }, []);

   const paginationValue = useMemo<GridPaginationContextValue>(
      () => ({
         gridRef,
         gridReady,
         pageSize,
         setPageSize,
         page,
         totalPages,
         rowCount,
         goToPage,
         clearSelection,
         refreshSnapshots,
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
         goToPage,
         clearSelection,
         refreshSnapshots,
         onGridReady,
         onGridPreDestroyed,
         onPaginationChanged,
         onSelectionChanged,
      ]
   );

   const selectionValue = useMemo<SelectionContextValue>(
      () => ({
         selectedIds,
         selectedIdSet: new Set(selectedIds),
         selectedObjects,
      }),
      [selectedIds, selectedObjects]
   );

   return (
      <GridPaginationContext.Provider value={paginationValue}>
         <SelectionContext.Provider value={selectionValue}>
            {children}
         </SelectionContext.Provider>
      </GridPaginationContext.Provider>
   );
};

const useGridPaginationContext = () => {
   const context = useContext(GridPaginationContext);
   if (!context)
      throw new Error(
         "useGridPaginationContext must be used within a GridProvider"
      );
   return context;
};

const useSelectionContext = () => {
   const context = useContext(SelectionContext);
   if (!context)
      throw new Error("useSelectionContext must be used within a GridProvider");
   return context;
};

const useGridContext = (): GridContextValue => {
   const pagination = useGridPaginationContext();
   const selection = useSelectionContext();
   return { ...pagination, ...selection };
};

export {
   GRID_CARD,
   GridProvider,
   HIDDEN_HEADER_TEXT,
   PAGE_SIZES,
   RIGHT_ALIGNED,
   useGridContext,
   useGridPaginationContext,
   useSelectionContext,
};
