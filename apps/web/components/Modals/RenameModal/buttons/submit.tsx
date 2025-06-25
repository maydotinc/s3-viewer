import useRenameServer from "@/lib/hooks/mutations/useRenameServer";
import { Button } from "@s3-viewer/ui/components/button";
import { LoaderCircle } from "lucide-react";

type SubmitButtonProps = {
   serverId: string;
   serverName: string;
   error: string | null;
   setError: (error: string | null) => void;
   onClose: () => void;
};

const SubmitButton = ({
   serverId,
   serverName,
   error,
   setError,
   onClose,
}: SubmitButtonProps) => {
   const renameServerMutation = useRenameServer();

   const handleSubmit = () => {
      if (serverName.length < 3) {
         setError("Server name must be at least 3 characters long");
         return;
      }

      renameServerMutation.mutate(
         { serverId, serverName },
         {
            onSuccess: () => {
               setError(null);
               onClose();
            },
            onError: (error) => {
               setError(error.message);
            },
         }
      );
   };

   return (
      <div className="flex flex-col gap-0 w-full">
         <Button
            className="w-full"
            variant="secondary"
            disabled={renameServerMutation.isPending || !!error}
            onClick={handleSubmit}
         >
            {renameServerMutation.isPending ? (
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
