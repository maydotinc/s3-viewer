import { BucketFolder } from "@/utils/types";
import { Checkbox } from "@s3-viewer/ui/components/checkbox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@s3-viewer/ui/components/dropdown-menu";
import { ColumnDef } from "@tanstack/react-table";
import { MoreVertical } from "lucide-react";
import Link from "next/link";

export const columns: ColumnDef<BucketFolder>[] = [
    {
        id: "select",
        header: ({ table }) => (
            <div className="flex h-4 items-center">
                <Checkbox
                    checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                    className="bg-white"
                />
            </div>
        ),
        cell: ({ row }) => (
            <div className="flex h-4 items-center">
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            </div>
        ),
        enableHiding: false,
        enableSorting: false,
    },
    {
        accessorKey: "Name",
        header: "Bucket Name",
        cell: ({ row }) => {
            const name : string = row.getValue("Name");
            return (
                <Link href={`/buckets/${name}`}>
                    <div className="text-left">
                        {name}
                    </div>
                </Link>
            );
        },
    },
    {
        accessorKey: "CreationDate",
        header: "Creation Date",
        cell: ({ row }) => {
            const date = new Date(row.getValue("CreationDate"));
            return date.toLocaleDateString();
        },
    },
    {
        accessorKey: "Files",
        header: "Files",
        cell: ({ row }) => {
            return "1"
            // return <div className="text-center">0</div>;
            // const files : number = row.getValue("Files");
            // return <div className="text-center">{files}</div>;
        },
    },
    {
        accessorKey: "Folders",
        header: "Folders",
        cell: ({ row }) => {
            return "1"
            // return <div className="text-center">0</div>;
            // const folders : number = row.getValue("Folders");
            // return <div className="text-center">{folders}</div>;
        },
    },
    {
        accessorKey: "TotalSize",
        header: "Total Size",
        cell: ({ row }) => {
            return "1"
            // return <div className="text-right">0</div>;
            // const size : number = row.getValue("TotalSize");
            // return <div className="text-right">{size}</div>;
        },
    },
    {
        id: "actions",
        cell: ({ row }) => {
            return (
                <div className="flex justify-end">
                    <DropdownMenu>
                        <DropdownMenuTrigger className="cursor-pointer">
                            {/* TODO: Actually add the actions */}
                            <MoreVertical className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem>
                                Delete Bucket
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )
        }
    }
];