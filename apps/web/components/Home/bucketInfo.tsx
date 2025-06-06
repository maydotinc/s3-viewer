import { fetchFolders } from "@/utils/fetching";
import { BucketFolder } from "@/utils/types";
import { useQuery } from "@tanstack/react-query";
import { ColDef, GridReadyEvent } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Loader2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import BaseGrid from "../DataGrid/baseGrid";
import GridActions from "../DataGrid/gridActions";
import BucketActions from "./bucketActions";
 
const columns: ColDef<BucketFolder>[] = [
    {
        field: "Name",
        headerName: "Bucket Name",
        flex: 2,
    },
    {
        field: "CreationDate",
        headerName: "Creation Date",
        flex: 1,
    },
    {
        field: "Files",
        headerName: "Files",
        flex: 1,
    },
    {
        field: "Folders",
        headerName: "Folders",
        flex: 1,
    },
    {
        field: "TotalSize",
        headerName: "Total Size",
        flex: 1,
    }
];

const BucketInfo = () => {
    const gridRef = useRef<AgGridReact>(null);
    const [gridReady, setGridReady] = useState(false);
    const [pageSize, setPageSize] = useState(25);

    const onGridReady = useCallback((params: GridReadyEvent) => {
        setGridReady(true);
    }, []);
    
    const { data: folders, isLoading } = useQuery({
        queryKey: ['folders'],
        queryFn: fetchFolders,
        refetchOnMount: true,
    });
      
    return (
        <section className="flex flex-col px-8 py-8 w-full h-full">
            <div className="flex lg:flex-row flex-col pb-6 justify-between">
                <GridActions gridRef={gridRef} gridReady={gridReady} setPageSize={setPageSize}/>
                <BucketActions />
            </div>
            {isLoading ? 
            <div className="flex justify-center items-center h-full">
                <Loader2 className="w-10 h-10 animate-spin" />
            </div> 
            : <BaseGrid rowData={folders ?? []} colDefs={columns} gridRef={gridRef} onGridReady={onGridReady} pageSize={pageSize} />}
        </section>
    )
}

export default BucketInfo;