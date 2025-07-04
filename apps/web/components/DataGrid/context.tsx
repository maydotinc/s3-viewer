import { GridReadyEvent } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { createContext, useContext, useRef, useState } from "react";

type GridContextType = {
   gridRef: React.RefObject<AgGridReact | null>;
   gridReady: boolean;
   pageSize: number;
   setPageSize: (size: number) => void;
   onGridReady: (params: GridReadyEvent) => void;
};

const GridContext = createContext<GridContextType | null>(null);

const GridProvider = ({ children }: { children: React.ReactNode }) => {
   const gridRef = useRef<AgGridReact>(null);
   const [gridReady, setGridReady] = useState(false);
   const [pageSize, setPageSize] = useState(25);

   const onGridReady = (params: GridReadyEvent) => {
      setGridReady(true);
   };

   const value = {
      gridRef,
      gridReady,
      pageSize,
      setPageSize,
      onGridReady,
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
