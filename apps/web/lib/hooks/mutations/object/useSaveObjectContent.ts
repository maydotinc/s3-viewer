import { type ObjectContent } from "@/lib/hooks/queries/s3/useObjectContent";
import { queryKeys } from "@/lib/query-keys";
import { uploadSingle } from "@/lib/utils/s3/upload-object";
import type { BucketTarget } from "@/lib/types";
import { type S3ObjectUploaded } from "@s3-viewer/shared";
import type { QueryClient } from "@tanstack/react-query";
import useObjectMutation from "./useObjectMutation";

type SaveObjectContentInput = BucketTarget & {
   objectKey: string;
   contentType: string;
   expectedETag: string;
   text: string;
};

const saveObjectContent = ({ text, ...target }: SaveObjectContentInput) =>
   uploadSingle({
      ...target,
      file: new File([text], target.objectKey, { type: target.contentType }),
      onProgress: () => undefined,
   }).done;

const cacheSavedContent = (
   queryClient: QueryClient,
   { userId, serverId, bucketName, objectKey, text }: SaveObjectContentInput,
   uploaded: S3ObjectUploaded
) => {
   queryClient.setQueryData<ObjectContent>(
      queryKeys.objectContent(userId, serverId, bucketName, objectKey),
      { text, eTag: uploaded.eTag }
   );
   for (const queryKey of [
      queryKeys.objectPreview(userId, serverId, bucketName, objectKey),
      queryKeys.objectSettings(userId, serverId, bucketName, objectKey),
      queryKeys.bucketSuggestions(userId, serverId, bucketName),
   ])
      void queryClient.invalidateQueries({ queryKey });
};

const useSaveObjectContent = () =>
   useObjectMutation({
      mutationFn: saveObjectContent,
      onSuccess: (uploaded, input, queryClient) =>
         cacheSavedContent(queryClient, input, uploaded),
   });

export default useSaveObjectContent;
export { cacheSavedContent };
