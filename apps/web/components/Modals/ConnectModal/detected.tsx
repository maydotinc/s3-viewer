import useConnectStore from "@/lib/stores/connectStore";
import { Separator } from "@s3-viewer/ui/components/separator";
import { Folder, HardDrive } from "lucide-react";

const ServerDetected = () => {
   const { serverName, bucketCount } = useConnectStore();

   return (
      <div className="flex flex-col gap-4 rounded-lg bg-viewerwhite p-4 border border-viewerborder">
         <label className="text-sm text-viewerlighttext flex text-left">
            DETECTED
         </label>
         <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-2">
               <label className="text-sm text-viewertext flex text-left">
                  Server Name
               </label>
               <div className="text-viewerblack flex items-center gap-2 text-left">
                  <HardDrive className="size-4 text-viewerblue" />
                  <span className="truncate max-w-[250px]">{serverName}</span>
               </div>
            </div>
            <Separator orientation="vertical" />
            <div className="flex flex-1 flex-col gap-2">
               <label className="text-sm text-viewertext flex text-left">
                  Buckets
               </label>
               <span className="text-viewerblack flex items-center gap-2 text-left">
                  <Folder className="size-4 text-viewerblue" />#{bucketCount}
               </span>
            </div>
         </div>
      </div>
   );
};

export default ServerDetected;
