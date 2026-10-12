import { useServerId } from "@/lib/stores/session-scope";
import { useUserId } from "@/lib/stores/session-store";
import BucketUnavailable from "@/components/Buckets/unavailable";
import {
   ObjectCommandsProvider,
   useCreateObjectCommands,
} from "@/components/Buckets/useObjectCommands";
import { Page } from "@/components/Layout/page";
import useObjectPreview from "@/lib/hooks/queries/s3/useObjectPreview";
import useObjectSettings from "@/lib/hooks/queries/s3/useObjectSettings";
import { folderAccessAt } from "@/lib/utils/folder-access";
import { baseName, canPresignObjectKey } from "@s3-viewer/types";
import { useState } from "react";
import { useBucketContext } from "@/components/Buckets/Context";
import { DottedPath, NoFolderAccess } from "@/components/Buckets/folder-access";
import ObjectDetails from "./details";
import { isEditableObject } from "./editable";
import ObjectEditor from "./editor";
import ObjectHeader from "./header";
import { LazyPreview } from "./lazy-preview";

const DETAILS_NEED_DOWNLOAD = new Error(
   "Your role can't download this file, so its details aren't available."
);

const ObjectViewSession = () => {
   const {
      bucketName,
      path,
      notFound,
      reach,
      bucketsError,
      refresh,
      isRefreshing,
   } = useBucketContext();
   const objectKey = path.join("/");
   const access = folderAccessAt(reach, objectKey);
   // each refused read is audited, so nothing is fetched until the file is within reach.
   const readable = access === "whole" || access === "inside";

   const preview = useObjectPreview(bucketName, objectKey, readable);
   const commands = useCreateObjectCommands(bucketName);
   const settings = useObjectSettings(
      bucketName,
      objectKey,
      readable && commands.can.download && !canPresignObjectKey(objectKey)
   );
   const [isEditing, setIsEditing] = useState(false);

   if (notFound) return <BucketUnavailable bucketName={bucketName} />;
   if (bucketsError && !reach)
      return (
         <BucketUnavailable
            bucketName={bucketName}
            error={bucketsError}
            failedAt="buckets"
            onRetry={refresh}
            retrying={isRefreshing}
         />
      );
   if (access === "dotted") return <DottedPath target="file" />;
   if (access === "leading" || access === "outside")
      return (
         <NoFolderAccess
            bucketName={bucketName}
            folders={reach?.folders ?? []}
            target="file"
            onRetry={refresh}
            retrying={isRefreshing}
         />
      );

   const metadata = preview.data ?? settings.data;
   const metadataQuery = canPresignObjectKey(objectKey) ? preview : settings;
   const detailsBlocked =
      !commands.isResolving &&
      !commands.can.download &&
      !canPresignObjectKey(objectKey);

   const metadataPending =
      !metadata && !detailsBlocked && metadataQuery.isPending;

   const canEdit =
      commands.can.upload &&
      isEditableObject(
         metadata?.contentType,
         objectKey,
         metadata?.contentLength
      );

   return (
      <ObjectCommandsProvider value={commands}>
         <Page>
            <ObjectHeader
               bucketName={bucketName}
               objectKey={objectKey}
               eTag={metadata?.eTag ?? null}
               metadataPending={metadataPending}
               path={path}
               canEdit={canEdit && !isEditing}
               editing={isEditing}
               onEdit={() => setIsEditing(true)}
            />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto max-lg:min-h-80 lg:flex-row">
               <ObjectDetails
                  details={metadata}
                  isLoading={metadataPending}
                  error={
                     metadata
                        ? null
                        : detailsBlocked
                          ? DETAILS_NEED_DOWNLOAD
                          : metadataQuery.error
                  }
                  onRetry={
                     metadata || detailsBlocked
                        ? undefined
                        : () => void metadataQuery.refetch()
                  }
                  retrying={metadataQuery.isFetching}
               />
               <div className="flex h-[28rem] min-w-0 shrink-0 flex-col pb-10 lg:h-full lg:min-h-0 lg:flex-1">
                  {isEditing ? (
                     <ObjectEditor
                        bucketName={bucketName}
                        objectKey={objectKey}
                        fileName={baseName(objectKey)}
                        contentType={metadata?.contentType ?? ""}
                        onClose={() => setIsEditing(false)}
                     />
                  ) : (
                     <LazyPreview
                        preview={preview.data}
                        refreshPreview={async () => {
                           const result = await preview.refetch();
                           return result.isError ? undefined : result.data;
                        }}
                        isLoading={preview.isPending}
                        isError={preview.isError}
                        objectKey={objectKey}
                        fileName={baseName(objectKey)}
                     />
                  )}
               </div>
            </div>
         </Page>
      </ObjectCommandsProvider>
   );
};

const ObjectView = () => {
   const userId = useUserId();
   const serverId = useServerId();
   const { bucketName, path } = useBucketContext();
   return (
      <ObjectViewSession
         key={JSON.stringify([userId, serverId, bucketName, path.join("/")])}
      />
   );
};

export default ObjectView;
