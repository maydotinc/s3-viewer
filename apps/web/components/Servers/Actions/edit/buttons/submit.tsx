import { useServerOperations } from "@/lib/hooks/useServer";
import { Button } from "@s3-viewer/ui/components/button";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";

type SubmitButtonProps = {
   serverId: string;
   serverName: string;
};

const SubmitButton = ({ serverId, serverName }: SubmitButtonProps) => {
   const [loading, setLoading] = useState(false);
   const { renameServer } = useServerOperations();

   const handleSubmit = async () => {
      setLoading(true);
      await renameServer(serverId, serverName);
      setLoading(false);
   };
   return (
      <div className="flex flex-col gap-0 w-full">
         <Button className="w-full" variant="secondary" disabled={loading} onClick={handleSubmit}>
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
