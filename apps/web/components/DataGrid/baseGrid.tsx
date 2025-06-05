import { AllCommunityModule, ColDef, ModuleRegistry, themeQuartz } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

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
    sortable: false,
    filter: false,
    resizable: false,
}

type BaseGridProps = {
    rowData: any[];
    colDefs: ColDef<any>[];
    quickFilterText: string;
}

const BaseGrid = ({ rowData, colDefs, quickFilterText }: BaseGridProps) => { 
    return (
        <div className="ag-theme-alpine w-full flex-1">
            <AgGridReact
                theme={viewerGridTheme}
                defaultColDef={defaultColDef}
                columnDefs={colDefs}
                rowData={rowData}
                quickFilterText={quickFilterText}
                pagination={true}
                suppressPaginationPanel={true}
            />
        </div>
    );
}; 

export default BaseGrid;