import { useServerOperations } from "@/lib/hooks/useServerOperations";
import { Button } from "@s3-viewer/ui/components/button";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";

type SubmitButtonProps = {
   serverId: string;
   serverName: string;
   error: string | null;
   setError: (error: string | null) => void;
   onClose: () => void;
};

const SubmitButton = ({ serverId, serverName, error, setError, onClose }: SubmitButtonProps) => {
   const [loading, setLoading] = useState(false);
   const { renameServer } = useServerOperations();

   const handleSubmit = async () => {
      setLoading(true);
      if (serverName.length < 3) {
         setLoading(false);
         setError("Server name must be at least 3 characters long");
         return;
      }
      const { success, message } = await renameServer(serverId, serverName);
      if (!success) {
         setError(message);
         setLoading(false);
         return;
      }
      setError(null);
      setLoading(false);
      onClose();
   };
   return (
      <div className="flex flex-col gap-0 w-full">
         <Button
            className="w-full"
            variant="secondary"
            disabled={loading || !!error}
            onClick={handleSubmit}
         >
            {loading ? (
               <span className="flex items-center gap-2">
                  <LoaderCircle className="animate-spin" />
                  Renaming
               </span>
            ) : (
               "Rename"
            )}
         </Button>
      </div>
   );
};

export default SubmitButton;
