import ServerSelector from "@/components/Layout/Sidebar/Servers/server-select";
import { Card, CardContent, CardTitle } from "@s3-viewer/ui/components/card";
import BucketList from "./Buckets";

const ServerManagement = () => {
   return (
      <Card className="rounded-xl max-h-full flex-1 flex flex-col p-1 select-none">
         <CardContent className="p-2 flex flex-col flex-1 gap-2 max-h-full">
            <CardTitle className="text-xs text-viewerlighttext">
               SERVERS
            </CardTitle>
            <ServerSelector />
            <CardTitle className="text-xs text-viewerlighttext">
               BUCKETS
            </CardTitle>
            <BucketList />
         </CardContent>
      </Card>
   );
};

export default ServerManagement;
