import { formatFileSize } from "@/lib/utils/fileUtils";
import { PreviewType } from "@/lib/utils/s3/previewHelpers";
import { Button } from "@s3-viewer/ui/components/button";
import { Eye } from "lucide-react";

interface RenderPreviewProps {
   url: string;
   objectName: string;
   previewType: PreviewType;
   contentLength?: number;
}

const RenderPreview = ({
   url,
   objectName,
   previewType,
   contentLength,
}: RenderPreviewProps) => {
   if (previewType === "image") {
      if (contentLength && contentLength > 50 * 1024 * 1024) {
         return (
            <div className="flex flex-col items-center justify-center text-center gap-4">
               <p>
                  Large image ({formatFileSize(contentLength).value}{" "}
                  {formatFileSize(contentLength).unit})
               </p>
               <Button
                  variant="outline"
                  onClick={() => window.open(url, "_blank")}
               >
                  Open in new tab
               </Button>
            </div>
         );
      }

      return (
         <img
            src={url}
            alt={objectName}
            className="max-w-full max-h-full object-contain select-none"
            draggable={false}
         />
      );
   }

   if (previewType === "video") {
      return (
         <video src={url} controls className="max-w-full max-h-full">
            Your browser does not support video playback.
         </video>
      );
   }

   if (previewType === "iframe") {
      return (
         <iframe
            src={url}
            className="w-full h-full border rounded bg-white select-none"
            title={`Preview of ${objectName}`}
            draggable={false}
         />
      );
   }

   return (
      <div className="flex flex-col items-center justify-center text-gray-500">
         <Eye className="h-12 w-12 mb-4 opacity-50" />
         <p>Preview not available</p>
      </div>
   );
};

export default RenderPreview;
