import useObjectMetadata from "@/lib/hooks/queries/s3/useObjectMetadata";
import useObjectPreview from "@/lib/hooks/queries/s3/useObjectPreview";
import useSessionStore from "@/lib/stores/sessionStore";
import { formatFileSize } from "@/lib/utils/fileUtils";
import { getPreviewType } from "@/lib/utils/s3/previewHelpers";
import { Button } from "@s3-viewer/ui/components/button";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { ArrowLeft, Download, Eye, Trash2 } from "lucide-react";
import { useRouter } from "next/router";
import { useBucketContext } from "./Context";
const ObjectView = () => {
   const router = useRouter();
   const serverId = useSessionStore((state) => state.serverId);
   const { path, bucket } = useBucketContext();
   const objectKey = path.join("/");

   // Use the bucketName from props which comes from URL
   const { data: metadata, isLoading: metadataLoading } = useObjectMetadata(
      serverId,
      bucket?.Name || "",
      objectKey
   );

   const { data: preview } = useObjectPreview(
      serverId,
      bucket?.Name || "",
      objectKey,
      metadata?.contentType
   );

   const previewType = getPreviewType(metadata?.contentType);
   const objectName = objectKey.split("/").pop() || objectKey;

   const handleBack = () => {
      // Remove object view query param
      const { view, ...restQuery } = router.query;
      router.push({
         pathname: router.pathname,
         query: restQuery,
      });
   };

   if (!bucket?.Name) {
      return (
         <section className="flex flex-col p-8 pt-6 w-full h-full items-center justify-center">
            <p>Invalid bucket name</p>
         </section>
      );
   }

   return (
      <section className="flex flex-col flex-1 overflow-hidden">
         {/* Action Bar */}
         <div className="flex items-center justify-between px-8 py-4 border-b">
            <div className="flex items-center gap-4">
               <Button variant="ghost" size="icon" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4" />
               </Button>
               <h1 className="text-lg font-medium">{objectName}</h1>
            </div>

            <div className="flex gap-2">
               <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Download
               </Button>
               <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
               </Button>
            </div>
         </div>

         <div className="flex flex-1 overflow-hidden">
            {/* Metadata Panel */}
            <div className="w-80 border-r p-6 overflow-y-auto bg-gray-50/50">
               <h2 className="text-base font-semibold mb-4">Object Details</h2>
               {metadataLoading ? (
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
                  <p className="text-sm text-gray-500">
                     Failed to load metadata
                  </p>
               )}
            </div>

            {/* Preview Area */}
            <div className="flex-1 p-8 flex items-center justify-center bg-gray-50">
               {preview?.url && previewType === "image" ? (
                  <img
                     src={preview.url}
                     alt={objectName}
                     className="max-w-full max-h-full object-contain"
                  />
               ) : preview?.url && previewType === "iframe" ? (
                  <iframe
                     src={preview.url}
                     className="w-full h-full border rounded bg-white"
                     title={`Preview of ${objectName}`}
                  />
               ) : (
                  <div className="flex flex-col items-center justify-center text-gray-500">
                     <Eye className="h-12 w-12 mb-4 opacity-50" />
                     <p>Preview not available</p>
                  </div>
               )}
            </div>
         </div>
      </section>
   );
};

export default ObjectView;
