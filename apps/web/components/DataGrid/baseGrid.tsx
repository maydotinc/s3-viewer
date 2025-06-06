import { Button } from "@s3-viewer/ui/components/button";
import { AllCommunityModule, ColDef, GridReadyEvent, ModuleRegistry, themeQuartz } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
        wrapperBorder: false
    });


const defaultColDef: ColDef = {
    sortable: true,
    filter: false,
    resizable: false,
}

type BaseGridProps = {
    rowData: any[];
    colDefs: ColDef<any>[];
    gridRef: React.RefObject<AgGridReact | null>;
    onGridReady: (params: GridReadyEvent) => void;
    pageSize: number;
}

const PaginationControls = () => {
    return (
        <div className="flex gap-2 mx-auto">
            <Button>
                <ChevronLeft className="size-4" />
            </Button>
            <Button>
                <ChevronRight className="size-4" />
            </Button>
        </div>
    )
}

const BaseGrid = ({ rowData, colDefs, gridRef, onGridReady, pageSize }: BaseGridProps) => { 
    return (
        <div className="w-full flex-1 flex flex-col">
            <div className="ag-theme-alpine flex-1">
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
            <PaginationControls />
        </div>
    );
}; 

export default BaseGrid;