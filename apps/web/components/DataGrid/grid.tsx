import useServers from "@/lib/hooks/queries/server/useServers";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { cn } from "@s3-viewer/ui/lib/utils";
import {
   AllCommunityModule,
   ColDef,
   ModuleRegistry,
   themeQuartz,
   ValidationModule,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useGridContext } from "./context";
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
   rowData?: any[];
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
};

const BaseGrid = ({
   rowData,
   colDefs,
   className,
   rowModel,
   noRowsOverlayComponent,
   routeContext,
}: BaseGridProps) => {
   const { gridRef, pageSize, onGridReady } = useGridContext();
   const { currentServer, isServerListLoading } = useServers();

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
              rowData,
           };

   if (isServerListLoading) {
      return (
         <section className="flex flex-col size-full items-center justify-center">
            <Skeleton className="size-full rounded-2xl" />
         </section>
      );
   }

   if (!currentServer) {
      return (
         <section className="flex flex-col size-full items-center justify-center">
            <h1 className="text-2xl font-bold text-viewerblack">
               Please connect to a server
            </h1>
            <p className="text-sm text-viewertext">
               You are not connected to any server. Please connect to a server
               to view your buckets.
            </p>
         </section>
      );
   }

   return (
      <div className={cn("w-full flex-1 ag-theme-alpine", className)}>
         <AgGridReact
            ref={gridRef}
            theme={viewerGridTheme}
            defaultColDef={defaultColDef}
            columnDefs={colDefs}
            onGridReady={onGridReady}
            pagination={true}
            suppressPaginationPanel={true}
            paginationPageSize={pageSize}
            noRowsOverlayComponent={noRowsOverlayComponent}
            context={routeContext}
            {...rowModelProps}
         />
      </div>
   );
};

export default BaseGrid;
