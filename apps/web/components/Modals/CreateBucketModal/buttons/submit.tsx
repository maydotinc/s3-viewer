import useCreateBucket from "@/lib/hooks/mutations/useCreateBucket";
import { Button } from "@s3-viewer/ui/components/button";
import { LoaderCircle } from "lucide-react";

type SubmitButtonProps = {
   serverId: string;
   bucketName: string;
   error: string | null;
   setError: (error: string | null) => void;
   onClose: () => void;
};

const SubmitButton = ({
   serverId,
   bucketName,
   error,
   setError,
   onClose,
}: SubmitButtonProps) => {
   const createBucketMutation = useCreateBucket(serverId);

   const handleSubmit = () => {
      if (bucketName.length < 3) {
         setError("Bucket name must be at least 3 characters long");
         return;
      }

      // Basic bucket name validation (AWS S3 rules)
      if (
         !/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(bucketName) ||
         bucketName.length > 63
      ) {
         setError(
            "Bucket name must be 3-63 characters, lowercase letters, numbers, dots and hyphens only"
         );
         return;
      }

      createBucketMutation.mutate(bucketName, {
         onSuccess: () => {
            setError(null);
            onClose();
         },
         onError: (error) => {
            setError(error.message);
         },
      });
   };

   return (
      <div className="flex flex-col gap-0 w-full">
         <Button
            className="w-full"
            variant="secondary"
            disabled={createBucketMutation.isPending || !!error}
            onClick={handleSubmit}
         >
            {createBucketMutation.isPending ? (
               <span className="flex items-center gap-2">
                  <LoaderCircle className="animate-spin" />
                  Creating
               </span>
            ) : (
               "Create Bucket"
            )}
         </Button>
      </div>
   );
};

export default SubmitButton;
