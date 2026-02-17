import useObjectMetadata from "@/lib/hooks/queries/s3/useObjectMetadata";
import useObjectPreview from "@/lib/hooks/queries/s3/useObjectPreview";
import { getPreviewType } from "@/lib/utils/s3/previewHelpers";
import { useMemo } from "react";
import ObjectActionsHeader from "./ActionsHeader";
import ObjectMetadata from "./Metadata";
import ObjectPreview from "./Preview";
import useObjectActions from "./useObjectActions";
import { authClient } from "@s3-viewer/auth/client";

const ObjectView = () => {
   const { data: session, isPending } = authClient.useSession();
   const {
      objectKey,
      objectName,
      serverId,
      bucket,
      isLoading,
      handleBack,
      handleDownload,
      handleDelete,
      handleRename,
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

   if (!session && isPending) return null;

   if (!session && !isPending)
      return (
         <div className="flex flex-col items-center justify-center pt-24">
            <p className="text-sm text-viewertext">Login to view this object</p>
         </div>
      );

   return (
      <section className="flex flex-col p-8 pt-6 w-full h-full overflow-hidden">
         <ObjectActionsHeader
            objectKey={objectKey}
            isLoading={isLoading}
            onBack={handleBack}
            onRename={handleRename}
            onDownload={handleDownload}
            onDelete={handleDelete}
         />

         <div className="flex flex-1 overflow-hidden max-lg:flex-col gap-4">
            <ObjectMetadata
               metadata={metadata}
               isLoading={
                  metadataLoading ||
                  (!metadata && (!serverId || !bucket?.Name || !objectKey))
               }
            />

            <ObjectPreview
               objectName={objectName}
               previewType={previewType}
               preview={preview}
               previewLoading={
                  metadataLoading ||
                  previewLoading ||
                  (!metadata && (!serverId || !bucket?.Name || !objectKey))
               }
               previewError={previewError}
               contentLength={metadata?.contentLength}
            />
         </div>
      </section>
   );
};

export default ObjectView;
