import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { cn } from "@s3-viewer/ui/lib/utils";
import { AllCommunityModule, ColDef, ModuleRegistry, themeQuartz } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useContext } from "react";
import { GridContext } from "../Home/bucketInfo";

ModuleRegistry.registerModules([
    AllCommunityModule
]);

const viewerGridTheme = themeQuartz
	.withParams({
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
        rangeSelectionBorderColor: "transparent"
    });

const defaultColDef: ColDef = {
    sortable: true,
    filter: false,
    resizable: false,
}

type BaseGridProps = {
    rowData: any[];
    colDefs: ColDef<any>[];
    className?: string;
}

const BaseGrid = ({ rowData, colDefs, className }: BaseGridProps) => { 
    const context = useContext(GridContext);
    if (!context) {
        return (
            <div className={cn("w-full flex-1", className)}>
                <Skeleton className="size-full" />
            </div>
        );
    }

    const { gridRef, pageSize, onGridReady } = context;
    return (
        <div className={cn("w-full flex-1 ag-theme-alpine", className)}>
            <AgGridReact
                ref={gridRef}
                theme={viewerGridTheme}
                defaultColDef={defaultColDef}
                columnDefs={colDefs}
                rowData={rowData}
                onGridReady={onGridReady}
                pagination={true}
                paginationPageSize={pageSize}
                suppressPaginationPanel={true}
            />
        </div>
    );
}; 

export default BaseGrid;