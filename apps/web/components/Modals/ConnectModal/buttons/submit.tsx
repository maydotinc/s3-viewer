import useCreateServer from "@/lib/hooks/mutations/server/useCreateServer";
import useEstablishConnection from "@/lib/hooks/mutations/server/useEstablishConnection";
import useConnectStore from "@/lib/stores/connectStore";
import useSessionStore from "@/lib/stores/sessionStore";
import { encryptCredentials } from "@/lib/utils/encryption";
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
      setListBucketsAllowed,
      listBucketsAllowed,
      manualBucketNames,
      reset,
   } = useConnectStore();
   const createServerMutation = useCreateServer();
   const establishConnectionMutation = useEstablishConnection();
   const setServerId = useSessionStore((state) => state.setServerId);

   const parseBucketNames = (): string[] => {
      return manualBucketNames
         .split(",")
         .map((name) => name.trim())
         .filter((name) => name.length > 0);
   };

   const handleSubmit = async () => {
      if (serverFound) {
         // For limited tokens, require at least one bucket name
         if (!listBucketsAllowed && parseBucketNames().length === 0) {
            setError("Please enter at least one bucket name");
            return;
         }

         try {
            const encryptedCredentials = await encryptCredentials({
               endpoint,
               region,
               accessKey,
               secretKey,
            });

            createServerMutation.mutate(
               {
                  encryptedCredentials,
                  serverName,
                  bucketNames: !listBucketsAllowed
                     ? parseBucketNames()
                     : undefined,
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
         } catch (error) {
            setError("Failed to encrypt credentials");
            setSearching(false);
         }
         return;
      }

      if (!endpoint || !serverName || !region || !accessKey || !secretKey) {
         setError("Please fill in all fields");
         return;
      }

      setSearching(true);

      try {
         const encryptedCredentials = await encryptCredentials({
            endpoint,
            region,
            accessKey,
            secretKey,
         });

         establishConnectionMutation.mutate(encryptedCredentials, {
            onSuccess: (data) => {
               setServerFound(true);
               setError(null);
               setSearching(false);
               setBucketCount(data.bucketCount);
               setListBucketsAllowed(data.listBucketsAllowed);
            },
            onError: (error) => {
               setError(error.message);
               setSearching(false);
            },
         });
      } catch (error) {
         setError("Failed to encrypt credentials");
         setSearching(false);
      }
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
