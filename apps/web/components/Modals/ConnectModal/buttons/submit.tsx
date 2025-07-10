import useCreateServer from "@/lib/hooks/mutations/server/useCreateServer";
import useEstablishConnection from "@/lib/hooks/mutations/server/useEstablishConnection";
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
   const createServerMutation = useCreateServer();
   const establishConnectionMutation = useEstablishConnection();
   const setServerId = useSessionStore((state) => state.setServerId);

   const handleSubmit = () => {
      if (serverFound) {
         createServerMutation.mutate(
            {
               serverCredentials: {
                  endpoint,
                  region,
                  accessKey,
                  secretKey,
               },
               serverName,
            },
            {
               onSuccess: (data) => {
                  setError(null);
                  setSearching(false);
                  setServerFound(true);
                  setServerId(data.serverId);
                  onClose();
                  reset();
               },
               onError: (error) => {
                  setError(error.message);
                  setSearching(false);
               },
            }
         );
         return;
      }

      if (!endpoint || !serverName || !region || !accessKey || !secretKey) {
         setError("Please fill in all fields");
         return;
      }

      setSearching(true);
      establishConnectionMutation.mutate(
         {
            endpoint,
            region,
            accessKey,
            secretKey,
         },
         {
            onSuccess: (data) => {
               setServerFound(true);
               setError(null);
               setSearching(false);
               setBucketCount(data.bucketCount);
            },
            onError: (error) => {
               setError(error.message);
               setSearching(false);
            },
         }
      );
   };

   const isLoading =
      searching ||
      createServerMutation.isPending ||
      establishConnectionMutation.isPending;

   return (
      <div className="flex flex-col gap-0 w-full">
         <Button
            className="w-full"
            variant="secondary"
            disabled={isLoading}
            onClick={handleSubmit}
         >
            {isLoading ? (
               <span className="flex items-center gap-2">
                  <LoaderCircle className="animate-spin" />
                  {serverFound ? "Connecting" : "Searching"}
               </span>
            ) : (
               "Connect"
            )}
         </Button>
      </div>
   );
};

export default SubmitButton;
