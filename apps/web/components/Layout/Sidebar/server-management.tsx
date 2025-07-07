import ServerSelector from "@/components/Layout/Sidebar/Servers/server-select";
import BucketList from "./Buckets";

const ServerManagement = () => {
   return (
      <div className="flex flex-col flex-1 rounded-xl max-h-full border border-viewerborder px-2 pt-2 pb-0 gap-3">
         <div className="flex flex-col gap-3">
            <span className="text-xs text-viewerlighttext">SERVERS</span>
            <ServerSelector />
         </div>
         <div className="flex flex-col overflow-auto gap-3">
            <span className="text-xs text-viewerlighttext">BUCKETS</span>
            <BucketList />
         </div>
      </div>
   );
};

export default ServerManagement;
