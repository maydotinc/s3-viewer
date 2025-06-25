import { establishConnection } from "@/lib/api/server";
import { ServerCredentials } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation } from "@tanstack/react-query";

const useEstablishConnection = () => {
   return useMutation({
      mutationFn: (credentials: ServerCredentials) =>
         establishConnection(credentials),

      onError: (error: Error) => {
         toast.error(error.message);
      },
   });
};

export default useEstablishConnection;
