import useConnectStore from "@/lib/stores/connectStore";
import useSessionStore from "@/lib/stores/sessionStore";
import { createServer, establishConnection } from "@/lib/utils/serverRequests";
import { Button } from "@s3-viewer/ui/components/button";
import { useQueryClient } from "@tanstack/react-query";
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
   } = useConnectStore();
   const queryClient = useQueryClient();
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
         queryClient.invalidateQueries({ queryKey: ["servers-list"] });
         queryClient.fetchQuery({ queryKey: ["servers-list"] });
         setServerId(serverId);
         onClose();
         return;
      }

      setSearching(true);
      if (!endpoint || !serverName || !region || !accessKey || !secretKey) {
         setError("Please fill in all fields");
         setSearching(false);
         return;
      }
      const { success, message } = await establishConnection({
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
