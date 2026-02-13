import useConnectStore from "@/lib/stores/connectStore";
import { Input } from "@s3-viewer/ui/components/input";
import { Separator } from "@s3-viewer/ui/components/separator";
import { AlertTriangle, Folder, HardDrive } from "lucide-react";

const ServerDetected = () => {
   const {
      serverName,
      bucketCount,
      listBucketsAllowed,
      manualBucketNames,
      setManualBucketNames,
   } = useConnectStore();

   if (!listBucketsAllowed) {
      return (
         <div className="flex flex-col gap-4 rounded-lg bg-viewerwhite p-4 border border-viewerborder">
            <div className="flex items-center gap-2">
               <AlertTriangle className="size-4 text-amber-500" />
               <label className="text-sm text-viewerlighttext flex text-left">
                  LIMITED TOKEN DETECTED
               </label>
            </div>
            <div className="flex flex-col gap-2">
               <div className="text-viewerblack flex items-center gap-2 text-left">
                  <HardDrive className="size-4 text-viewerblue" />
                  <span className="truncate max-w-[250px]">{serverName}</span>
               </div>
               <p className="text-xs text-viewertext">
                  This token cannot list all buckets. Enter the bucket names
                  this token has access to.
               </p>
               <Input
                  placeholder="bucket1, bucket2, bucket3"
                  value={manualBucketNames}
                  onChange={(e) => setManualBucketNames(e.target.value)}
                  className="text-black"
               />
               <p className="text-xs text-viewerlighttext">
                  Comma-separated bucket names
               </p>
            </div>
         </div>
      );
   }

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
