import { Button } from "@s3-viewer/ui/components/button"
import { Input } from "@s3-viewer/ui/components/input"
import { Table } from "@tanstack/react-table"
import { Code, Filter, Plus, Share, SortDesc } from "lucide-react"

type TableActionsProps<TData> = {
    table: Table<TData>
}

const TableActions = <TData,>({table}: TableActionsProps<TData>) => {
    return (
        <div className="pt-6 w-full flex">
            <div className="flex gap-2">
                <div className="w-md">
                    <Input
                        placeholder="Filter folders..."
                        value={(table.getColumn("Name")?.getFilterValue() as string) ?? ""}
                        onChange={(event) => table.getColumn("Name")?.setFilterValue(event.target.value)}
                    />
                </div>
                <Button>
                    <Filter className="size-4" />
                    Filter
                </Button>
                <Button>
                    <SortDesc className="size-4" />
                    Sort by
                </Button>
            </div>
            <div className="ml-auto flex gap-2">
                <Button>
                    <Share className="size-4" />
                    Share
                </Button>
                <Button>
                    <Code className="size-4" />
                    API
                </Button>
                <Button variant="outline">
                    <Plus className="size-4" />
                    Create Bucket
                </Button>
            </div>
        </div>
    )
}
export default TableActions;
