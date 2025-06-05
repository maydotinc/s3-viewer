import { Button } from "@s3-viewer/ui/components/button";
import { Input } from "@s3-viewer/ui/components/input";

type BucketActionsProps = {
    quickFilterText: string;
    setQuickFilterText: (text: string) => void;
}

const BucketActions = ({ quickFilterText, setQuickFilterText }: BucketActionsProps) => {
    return (
        <div className="md:flex md:flex-row flex-col py-4">
            <div className="flex gap-2 w-1/2">
                <Input 
                    placeholder="Search..." 
                    className="flex-3 md:min-w-1/2" 
                    onChange={(e) => setQuickFilterText(e.target.value)}
                    value={quickFilterText}
                />
                <Button className="flex-1">
                    Filter
                </Button>
                <Button className="flex-1">
                    Sort by
                </Button>
                <Button className="flex-1">
                    Rows per page
                </Button>
            </div>
            <div className="flex ml-auto gap-2">
                <Button className="flex-1">
                    Share
                </Button>
                <Button className="flex-1">
                    API
                </Button>
                <Button className="flex-1" variant="secondary">
                    Create Bucket
                </Button>
            </div>
        </div>
    )
}

export default BucketActions;