import { useServerOperations } from "@/lib/hooks/useServerOperations";
import useConnectStore from "@/lib/stores/connectStore";
import useSessionStore from "@/lib/stores/sessionStore";
import { Button } from "@s3-viewer/ui/components/button";
import { LoaderCircle } from "lucide-react";

type SubmitButtonProps = {
   onClose: () => void;
};

const SubmitButton = ({ onClose }: SubmitButtonProps) => {
   const {
      endpoint,
      serverName,
      region,
      accessKey,
      secretKey,
      searching,
      setSearching,
      serverFound,
      setServerFound,
      setError,
      setBucketCount,
      reset,
   } = useConnectStore();
   const { createServer, establishConnection } = useServerOperations();
   const setServerId = useSessionStore((state) => state.setServerId);

   const handleSubmit = async () => {
      if (serverFound) {
         const { success, message, serverId } = await createServer(
            {
               endpoint,
               region,
               accessKey,
               secretKey,
            },
            serverName
         );
         if (!success) {
            setError(message);
            setSearching(false);
            return;
         }
         setError(null);
         setSearching(false);
         setServerFound(true);
         setServerId(serverId);
         onClose();
         reset();
         return;
      }

      setSearching(true);
      if (!endpoint || !serverName || !region || !accessKey || !secretKey) {
         setError("Please fill in all fields");
         setSearching(false);
         return;
      }
      const { success, message, bucketCount } = await establishConnection({
         endpoint,
         region,
         accessKey,
         secretKey,
      });
      if (!success) {
         setError(message);
         setSearching(false);
         return;
      }
      setServerFound(true);
      setError(null);
      setSearching(false);
      setBucketCount(bucketCount);
   };

   return (
      <div className="flex flex-col gap-0 w-full">
         <Button className="w-full" variant="secondary" disabled={searching} onClick={handleSubmit}>
            {searching ? (
               <span className="flex items-center gap-2">
                  <LoaderCircle className="animate-spin" />
                  Searching
               </span>
            ) : (
               "Connect"
            )}
         </Button>
      </div>
   );
};

export default SubmitButton;
