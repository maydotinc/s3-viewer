import { Input } from "@s3-viewer/ui/components/input";
import { cn } from "@s3-viewer/ui/lib/utils";

type BucketNameInputProps = {
   bucketName: string;
   setBucketName: (bucketName: string) => void;
   setError: (error: string | null) => void;
};

const BucketNameInput = ({
   bucketName,
   setBucketName,
   setError,
}: BucketNameInputProps) => {
   return (
      <div className="flex flex-col">
         <label
            htmlFor="bucketName"
            className="text-sm font-medium text-black flex items-center gap-1"
         >
            Bucket Name<span className="text-viewerblue text-lg">*</span>
         </label>
         <Input
            id="bucketName"
            type="text"
            placeholder="my-bucket-name"
            className={cn("w-full transition-colors duration-300 text-black")}
            value={bucketName}
            onChange={(e) => {
               setBucketName(e.target.value);
               setError(null);
            }}
         />
      </div>
   );
};

export default BucketNameInput;
