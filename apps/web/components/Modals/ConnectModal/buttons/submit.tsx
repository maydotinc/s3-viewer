import useConnectStore from "@/lib/stores/connectStore";
import { Button } from "@s3-viewer/ui/components/button";
import { LoaderCircle } from "lucide-react";

const SubmitButton = () => {
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

   const handleSubmit = async () => {
      setSearching(true);
      if (!endpoint || !serverName || !region || !accessKey || !secretKey) {
         setError("Please fill in all fields");
         setSearching(false);
         return;
      }
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
