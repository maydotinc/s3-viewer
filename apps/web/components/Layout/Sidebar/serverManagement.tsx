import ServerSelector from "@/components/Servers/serverSelect";
import { Card, CardContent, CardTitle } from "@s3-viewer/ui/components/card";

const ServerManagement = () => {
    return (
        <Card className="rounded-2xl w-full p-1">
            <CardContent className="p-2 flex flex-col gap-2">
                <CardTitle className="text-xs text-viewerlighttext">
                    SERVERS
                </CardTitle>
                <ServerSelector />
                <CardTitle className="text-xs text-viewerlighttext">
                    BUCKETS
                </CardTitle>
                <p>Bucket list?</p>
            </CardContent>
        </Card>
    );
}

export default ServerManagement;