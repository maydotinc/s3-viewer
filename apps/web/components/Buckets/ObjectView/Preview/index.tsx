import { PreviewType } from "@/lib/utils/s3/previewHelpers";
import { Eye, Loader } from "lucide-react";
import RenderPreview from "./RenderPreview";

interface ObjectPreviewProps {
   objectName: string;
   previewType: PreviewType;
   preview: { url: string } | undefined;
   previewError: boolean;
   previewLoading: boolean;
   contentLength?: number;
}

const ObjectPreview = ({
   objectName,
   previewType,
   preview,
   previewError,
   previewLoading,
   contentLength,
}: ObjectPreviewProps) => {
   return (
      <div className="flex-1 p-8 flex items-center justify-center bg-gray-50 rounded-xl">
         {previewLoading ? (
            <div className="flex flex-col items-center justify-center">
               <Loader className="h-12 w-12 animate-spin" />
            </div>
         ) : previewError || !preview?.url ? (
            <div className="flex flex-col items-center justify-center text-gray-500">
               <Eye className="h-12 w-12 mb-4 opacity-50" />
               <p>
                  {previewError ? "Error loading preview" : "Preview not available"}
               </p>
            </div>
         ) : (
            <RenderPreview
               url={preview.url}
               objectName={objectName}
               previewType={previewType}
               contentLength={contentLength}
            />
         )}
      </div>
   );
};

export default ObjectPreview;
