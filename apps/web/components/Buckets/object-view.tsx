import { useModalContext } from "@/lib/contexts/ModalContext";
import useObjectMetadata from "@/lib/hooks/queries/s3/useObjectMetadata";
import useObjectPreview from "@/lib/hooks/queries/s3/useObjectPreview";
import useSessionStore from "@/lib/stores/sessionStore";
import { formatFileSize } from "@/lib/utils/fileUtils";
import getPresignedDownloadUrl from "@/lib/utils/s3/getPresignedDownloadUrl";
import { getPreviewType } from "@/lib/utils/s3/previewHelpers";
import { Button } from "@s3-viewer/ui/components/button";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { ArrowLeft, Download, Eye, Loader, Trash2 } from "lucide-react";
import { useRouter } from "next/router";
import { useState } from "react";
import { useBucketContext } from "./Context";

const ObjectView = () => {
   const router = useRouter();
   const [isLoading, setIsLoading] = useState(false);
   const { openConfirmDeleteModal } = useModalContext();
   const serverId = useSessionStore((state) => state.serverId);
   const { path, bucket } = useBucketContext();
   const objectKey = path.join("/");
   const { data: metadata, isLoading: metadataLoading } = useObjectMetadata(
      serverId,
      bucket?.Name || "",
      objectKey
   );
   const {
      data: preview,
      isFetching: previewFetching,
      isLoading: previewLoading,
      isError: previewError,
   } = useObjectPreview(
      serverId,
      bucket?.Name || "",
      objectKey,
      metadata?.contentType
   );

   const previewType = getPreviewType(metadata?.contentType);
   const objectName = objectKey.split("/").pop() || objectKey;

   const handleBack = () => {
      const slug = router.query.slug;
      if (!Array.isArray(slug) || slug.length === 0) {
         router.push("/buckets");
         return;
      }
      const newSlug = slug.slice(0, -1);
      router.push({
         pathname: router.pathname,
         query: {
            slug: newSlug,
         },
      });
   };

   const handleDownload = async () => {
      setIsLoading(true);
      console.log("Downloading file", objectKey);
      if (!bucket?.Name || !serverId || !objectKey) {
         console.error(
            "Missing bucket name, server ID, file name, or file size"
         );
         setIsLoading(false);
         return;
      }
      try {
         const { url } = await getPresignedDownloadUrl(
            bucket?.Name,
            objectKey,
            serverId
         );
         if (!url) {
            console.error("No URL returned from presigned download URL");
            setIsLoading(false);
            return;
         }

         window.open(url, "_blank");
      } catch (error) {
         console.error("Unable to download file", error);
      } finally {
         setIsLoading(false);
      }
   };

   const handleDelete = async () => {
      if (!bucket?.Name || !serverId) {
         console.error(
            "Missing bucket name or server ID, cannot delete object"
         );
         return;
      }
      openConfirmDeleteModal({
         serverId,
         bucketName: bucket?.Name,
         fileNames: [objectKey],
         onDeleteSuccess: handleBack,
      });
   };

   return (
      <section className="flex flex-col p-8 pt-6 w-full h-full overflow-hidden">
         <div className="flex pb-6 gap-4 w-full justify-between max-w-full max-lg:flex-col max-lg:justify-start">
            <div className="flex items-center gap-4 min-w-0">
               <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBack}
                  className="flex items-center"
               >
                  <ArrowLeft className="size-5" />
               </Button>
               <h1 className="truncate text-lg max-w-[400px]">{objectName}</h1>
            </div>
            <div className="flex gap-2">
               <Button
                  variant="outline"
                  onClick={handleDownload}
                  disabled={isLoading}
               >
                  <Download className="size-4" />
                  Download
               </Button>
               <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isLoading}
               >
                  <Trash2 className="size-4" />
                  Delete
               </Button>
            </div>
         </div>

         <div className="flex flex-1 overflow-hidden max-lg:flex-col gap-4">
            <div className="w-80 overflow-y-auto">
               <h1 className="font-semibold mb-4">Object Details</h1>
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

            <div className="flex-1 p-8 flex items-center justify-center bg-gray-50 rounded-xl">
               {preview === undefined && !previewError ? (
                  <div className="flex flex-col items-center justify-center">
                     <Loader className="h-12 w-12 animate-spin" />
                  </div>
               ) : preview?.url && previewType === "image" ? (
                  metadata?.contentLength &&
                  metadata.contentLength > 50 * 1024 * 1024 ? (
                     <div className="flex flex-col items-center justify-center text-center gap-4">
                        <p>
                           Large image (
                           {formatFileSize(metadata.contentLength).value}{" "}
                           {formatFileSize(metadata.contentLength).unit})
                        </p>
                        <Button
                           variant="outline"
                           onClick={() => window.open(preview.url, "_blank")}
                        >
                           Open in new tab
                        </Button>
                     </div>
                  ) : (
                     <img
                        src={preview.url}
                        alt={objectName}
                        className="max-w-full max-h-full object-contain select-none"
                        draggable={false}
                     />
                  )
               ) : preview?.url && previewType === "video" ? (
                  <video
                     src={preview.url}
                     controls
                     className="max-w-full max-h-full"
                  >
                     Your browser does not support video playback.
                  </video>
               ) : preview?.url && previewType === "iframe" ? (
                  <iframe
                     src={preview.url}
                     className="w-full h-full border rounded bg-white select-none"
                     title={`Preview of ${objectName}`}
                     draggable={false}
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
