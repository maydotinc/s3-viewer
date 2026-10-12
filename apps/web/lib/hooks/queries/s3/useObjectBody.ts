import { PRESIGN_STALE_MS } from "@/lib/utils/s3/presign";
import { MAX_JSON_PREVIEW_BYTES } from "@/lib/utils/file-utils";
import {
   PreviewTooLargeError,
   previewBodyVersion,
   readPreviewText,
} from "@/lib/utils/s3/preview-body";
import { queryKeys } from "@/lib/query-keys";
import { isScoped, useSessionScope } from "@/lib/stores/session-scope";
import { MAX_EDIT_BYTES, type S3ObjectPreview } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { readObjectContent } from "./useObjectContent";

class PreviewChangedError extends Error {
   constructor() {
      super("The object changed. Refresh to preview its latest contents.");
      this.name = "PreviewChangedError";
   }
}

class ObjectBodyError extends Error {
   readonly tooLarge: boolean;
   readonly changed: boolean;

   constructor(
      readonly url: string,
      cause: unknown
   ) {
      super(
         cause instanceof Error
            ? cause.message
            : "The object couldn't be read.",
         { cause }
      );
      this.name = "ObjectBodyError";
      this.tooLarge = cause instanceof PreviewTooLargeError;
      this.changed = cause instanceof PreviewChangedError;
   }
}

const useObjectBody = (
   bucketName: string,
   objectKey: string,
   preview: S3ObjectPreview,
   enabled = true
) => {
   const { userId, serverId } = useSessionScope();
   const query = useQuery({
      queryKey: queryKeys.objectPreviewBody(
         userId,
         serverId,
         bucketName,
         objectKey,
         previewBodyVersion(preview)
      ),
      queryFn: async ({ signal }) => {
         try {
            let response: Response;
            try {
               response = await fetch(preview.url, { signal });
            } catch (error) {
               if (
                  signal.aborted ||
                  preview.contentEncoding ||
                  preview.contentLength > MAX_EDIT_BYTES
               )
                  throw error;
               const content = await readObjectContent(
                  serverId,
                  bucketName,
                  objectKey,
                  signal
               );
               if (
                  preview.eTag &&
                  content.eTag &&
                  preview.eTag !== content.eTag
               )
                  throw new PreviewChangedError();
               return content.text.replace(/^\uFEFF/, "");
            }
            if (!response.ok) {
               void response.body?.cancel().catch(() => undefined);
               throw new Error(
                  `The object couldn't be read (${response.status}).`
               );
            }
            const eTag = response.headers.get("etag");
            const versionId = response.headers.get("x-amz-version-id");
            if (
               (preview.eTag && eTag && preview.eTag !== eTag) ||
               (preview.versionId &&
                  versionId &&
                  preview.versionId !== versionId)
            ) {
               void response.body?.cancel().catch(() => undefined);
               throw new PreviewChangedError();
            }
            return await readPreviewText(response, MAX_JSON_PREVIEW_BYTES);
         } catch (error) {
            throw new ObjectBodyError(preview.url, error);
         }
      },
      enabled: enabled && isScoped(preview.url, userId, serverId, objectKey),
      staleTime: Infinity,
      gcTime: PRESIGN_STALE_MS,
      retry: false,
   });
   const { error, refetch } = query;
   useEffect(() => {
      if (
         enabled &&
         error instanceof ObjectBodyError &&
         !error.tooLarge &&
         error.url !== preview.url
      )
         void refetch();
   }, [enabled, error, preview.url, refetch]);
   return query;
};

export { ObjectBodyError };
export default useObjectBody;
