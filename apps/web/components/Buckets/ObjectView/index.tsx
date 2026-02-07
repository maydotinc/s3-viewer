import useObjectMetadata from "@/lib/hooks/queries/s3/useObjectMetadata";
import useObjectPreview from "@/lib/hooks/queries/s3/useObjectPreview";
import { getPreviewType } from "@/lib/utils/s3/previewHelpers";
import { useMemo } from "react";
import ObjectActionsHeader from "./ActionsHeader";
import ObjectMetadata from "./Metadata";
import ObjectPreview from "./Preview";
import useObjectActions from "./useObjectActions";

const ObjectView = () => {
   const {
      objectKey,
      objectName,
      serverId,
      bucket,
      isLoading,
      handleBack,
      handleDownload,
      handleDelete,
   } = useObjectActions();

   const { data: metadata, isLoading: metadataLoading } = useObjectMetadata(
      serverId,
      bucket?.Name || "",
      objectKey
   );

   const {
      data: preview,
      isError: previewError,
      isLoading: previewLoading,
   } = useObjectPreview(
      serverId,
      bucket?.Name || "",
      objectKey,
      metadata?.contentType
   );

   const previewType = useMemo(
      () => getPreviewType(metadata?.contentType),
      [metadata?.contentType]
   );

   return (
      <section className="flex flex-col p-8 pt-6 w-full h-full overflow-hidden">
         <ObjectActionsHeader
            objectName={objectName}
            isLoading={isLoading}
            onBack={handleBack}
            onDownload={handleDownload}
            onDelete={handleDelete}
         />

         <div className="flex flex-1 overflow-hidden max-lg:flex-col gap-4">
            <ObjectMetadata metadata={metadata} isLoading={metadataLoading} />

            <ObjectPreview
               objectName={objectName}
               previewType={previewType}
               preview={preview}
               previewLoading={metadataLoading || previewLoading}
               previewError={previewError}
               contentLength={metadata?.contentLength}
            />
         </div>
      </section>
   );
};

export default ObjectView;
