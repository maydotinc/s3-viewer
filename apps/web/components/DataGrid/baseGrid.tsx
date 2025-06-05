import { AllCommunityModule, ColDef, ModuleRegistry, themeAlpine } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

ModuleRegistry.registerModules([
    AllCommunityModule
]);

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
        <div className="ag-theme-alpine w-full h-full">
            <AgGridReact
                theme={themeAlpine}
                defaultColDef={defaultColDef}
                columnDefs={colDefs}
                rowData={rowData}
                quickFilterText={quickFilterText}
            />
        </div>
    );
}; 

export default BaseGrid;