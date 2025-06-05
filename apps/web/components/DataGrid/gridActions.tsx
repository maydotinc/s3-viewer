import { Button } from "@s3-viewer/ui/components/button";
import { Input } from "@s3-viewer/ui/components/input";

type BucketActionsProps = {
    quickFilterText: string;
    setQuickFilterText: (text: string) => void;
}

const BucketActions = ({ quickFilterText, setQuickFilterText }: BucketActionsProps) => {
    return (
        <div className="flex gap-2">
            <Input 
                placeholder="Search..." 
                className="flex-1 md:min-w-1/2" 
                onChange={(e) => setQuickFilterText(e.target.value)}
                value={quickFilterText}
            />
            <Button>
                Filter
            </Button>
            <Button>
                Sort by
            </Button>
            <Button>
                Rows per page
            </Button>
        </div>
    )
}

export default BucketActions;