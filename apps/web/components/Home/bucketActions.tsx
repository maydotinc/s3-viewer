import { Button } from "@s3-viewer/ui/components/button";
import { CodeXml, Plus, UserRoundPlus } from "lucide-react";

const BucketActions = () => {
    return (
        <div className="flex gap-2">
            <Button className="hidden lg:inline-flex">
                <UserRoundPlus className="size-4" />
                Share
            </Button>
            <Button>
                <CodeXml className="size-4" />
                API
            </Button>
            <Button variant="secondary">
                <Plus className="size-4" />
                Create Bucket
            </Button>
        </div>
    )   
}

export default BucketActions;