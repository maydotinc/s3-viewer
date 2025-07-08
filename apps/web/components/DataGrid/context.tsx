import { GridReadyEvent } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { createContext, useContext, useEffect, useRef, useState } from "react";

type GridContextType = {
   gridRef: React.RefObject<AgGridReact | null>;
   gridReady: boolean;
   pageSize: number;
   setPageSize: (size: number) => void;
   onGridReady: (params: GridReadyEvent) => void;
   totalPages: number | "many";
   currentPage: number;
};

const GridContext = createContext<GridContextType | null>(null);

type GridProviderProps = {
   children: React.ReactNode;
};

const GridProvider = ({ children }: GridProviderProps) => {
   const gridRef = useRef<AgGridReact>(null);
   const [gridReady, setGridReady] = useState(false);
   const [pageSize, setPageSize] = useState(25);
   const [totalPages, setTotalPages] = useState<number | "many">(0);
   const [currentPage, setCurrentPage] = useState(0);

   useEffect(() => {
      if (!gridReady || !gridRef.current?.api) return;
      const api = gridRef.current.api;
      const handler = () => {
         setCurrentPage(api.paginationGetCurrentPage() ?? 1);
         setTotalPages(
            api.paginationIsLastPageFound()
               ? (api.paginationGetTotalPages() ?? 1)
               : "many"
         );
      };

      handler();
      api.addEventListener("paginationChanged", handler);

      return () => {
         if (!api.isDestroyed()) {
            api.removeEventListener("paginationChanged", handler);
         }
      };
   }, [gridReady]);

   const onGridReady = (params: GridReadyEvent) => {
      setGridReady(true);
   };

   const value = {
      gridRef,
      gridReady,
      pageSize,
      setPageSize,
      onGridReady,
      totalPages,
      currentPage,
   };
   return <GridContext.Provider value={value}>{children}</GridContext.Provider>;
};

const useGridContext = () => {
   const context = useContext(GridContext);
   if (!context) {
      throw new Error("useGridContext must be used within a GridProvider");
   }
   return context;
};

export { GridProvider, useGridContext };
