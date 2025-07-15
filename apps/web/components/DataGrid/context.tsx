import { GridReadyEvent } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { createContext, useContext, useEffect, useRef, useState } from "react";

type GridContextType = {
   gridRef: React.RefObject<AgGridReact | null>;
   gridReady: boolean;
   pageSize: number;
   setPageSize: (size: number) => void;
   onGridReady: (params: GridReadyEvent) => void;
   onGridDestroy: () => void;
   totalPages: number | "many" | null;
   currentPage: number | null;
   setCurrentPage: (page: number) => void;
};

const GridContext = createContext<GridContextType | null>(null);

type GridProviderProps = {
   children: React.ReactNode;
};

const GridProvider = ({ children }: GridProviderProps) => {
   const gridRef = useRef<AgGridReact>(null);
   const [gridReady, setGridReady] = useState(false);
   const [pageSize, setPageSize] = useState(100);
   const [totalPages, setTotalPages] = useState<number | "many" | null>(null);
   const [currentPage, setCurrentPage] = useState<number | null>(null);

   const paginationChangeHandler = () => {
      if (!gridRef.current?.api) return;
      const api = gridRef.current.api;
      console.log("Setting current page and total pages");
      setCurrentPage(api.paginationGetCurrentPage() ?? 1);
      setTotalPages(
         api.paginationIsLastPageFound()
            ? (api.paginationGetTotalPages() ?? 1)
            : "many"
      );
   };

   useEffect(() => {
      if (!gridReady || !gridRef.current?.api) return;
      const api = gridRef.current.api;
      api.addEventListener("paginationChanged", paginationChangeHandler);
      return () => {};
   }, [gridReady]);

   const onGridReady = (params: GridReadyEvent) => {
      console.log("Grid ready");
      setGridReady(true);
   };

   const onGridDestroy = () => {
      console.log("Grid getting destroyed");
      if (gridRef.current?.api) {
         gridRef.current.api.removeEventListener(
            "paginationChanged",
            paginationChangeHandler
         );
      }

      setTotalPages(null);
      setCurrentPage(null);
      setGridReady(false);
   };

   const value = {
      gridRef,
      gridReady,
      pageSize,
      setPageSize,
      onGridReady,
      onGridDestroy,
      totalPages,
      currentPage,
      setCurrentPage,
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
