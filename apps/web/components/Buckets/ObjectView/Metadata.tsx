import { formatFileSize } from "@/lib/utils/fileUtils";
import { S3ObjectMetadata } from "@s3-viewer/types";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";

interface ObjectMetadataProps {
   metadata: S3ObjectMetadata | undefined;
   isLoading: boolean;
}

const ObjectMetadata = ({ metadata, isLoading }: ObjectMetadataProps) => {
   return (
      <div className="w-80 overflow-y-auto">
         <h1 className="font-semibold mb-4">Object Details</h1>
         {isLoading ? (
            <div className="space-y-3">
               {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
               ))}
            </div>
         ) : metadata ? (
            <div className="space-y-4">
               <div>
                  <p className="text-sm text-gray-500">Size</p>
                  <p className="font-medium">
                     {metadata.contentLength
                        ? (() => {
                             const { value, unit } = formatFileSize(
                                metadata.contentLength
                             );
                             return `${value} ${unit}`;
                          })()
                        : "Unknown"}
                  </p>
               </div>
               <div>
                  <p className="text-sm text-gray-500">Last Modified</p>
                  <p className="font-medium">
                     {metadata.lastModified
                        ? new Date(metadata.lastModified).toLocaleString()
                        : "Unknown"}
                  </p>
               </div>
               <div>
                  <p className="text-sm text-gray-500">Content Type</p>
                  <p className="font-medium">
                     {metadata.contentType || "Unknown"}
                  </p>
               </div>
               <div>
                  <p className="text-sm text-gray-500">Storage Class</p>
                  <p className="font-medium">
                     {metadata.storageClass || "STANDARD"}
                  </p>
               </div>
            </div>
         ) : (
            <p className="text-sm text-gray-500">Failed to load metadata</p>
         )}
      </div>
   );
};

export default ObjectMetadata;
