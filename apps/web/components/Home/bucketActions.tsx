import { Button } from "@s3-viewer/ui/components/button";

const BucketActions = () => {
    return (
        <div className="flex gap-2">
            <Button className="hidden xl:inline-flex">
                Share
            </Button>
            <Button>
                API
            </Button>
            <Button variant="secondary">
                Create Bucket
            </Button>
        </div>
    )   
}

export default BucketActions;