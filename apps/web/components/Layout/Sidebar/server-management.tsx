import ServerSelector from "@/components/Layout/Sidebar/Servers/server-select";
import { Card, CardContent, CardTitle } from "@s3-viewer/ui/components/card";

const ServerManagement = () => {
   return (
      <Card className="rounded-xl w-full p-1 select-none">
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
};

export default ServerManagement;
