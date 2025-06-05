import { fetchFolders } from "@/utils/fetching";
import { BucketFolder } from "@/utils/types";
import { useQuery } from "@tanstack/react-query";
import { ColDef } from "ag-grid-community";
import { useRouter } from "next/router";
import { useState } from "react";
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
    const testBuckets : BucketFolder[] = [];
    for (let i = 0; i < 100; i++) {
        testBuckets.push({
            Name: `Bucket ${i}`,
            CreationDate: new Date(),
            Files: 0,
            Folders: 0,
            TotalSize: 0,
        })
    }
    
    const router = useRouter();
    const [quickFilterText, setQuickFilterText] = useState("");
    const { data: folders, isLoading: isLoadingFolders } = useQuery({
        queryKey: ['folders'],
        queryFn: fetchFolders,
        refetchOnMount: true,
    });
      
    return (
        <section className="flex flex-col px-8 py-8 w-full h-full">
            <div className="flex xl:flex-row flex-col pb-8 justify-between">
                <GridActions quickFilterText={quickFilterText} setQuickFilterText={setQuickFilterText}/>
                <BucketActions />
            </div>
            <BaseGrid rowData={folders ?? []} colDefs={columns} quickFilterText={quickFilterText} />
        </section>
    )
}

export default BucketInfo;