import { api, multipartUploadsPath, qs } from "@/lib/api";
import useCursorQuery from "@/lib/hooks/queries/useCursorQuery";
import { queryKeys } from "@/lib/query-keys";
import { useUserId } from "@/lib/stores/session-store";
import type { S3MultipartUploadPage } from "@s3-viewer/types";

type UploadsMarker = { keyMarker: string; uploadIdMarker: string | null };

const pageUploads = (page: S3MultipartUploadPage) => page.uploads;

// S3 pages multipart listings by a (key, upload id) pair rather than one opaque cursor.
const nextMarker = (page: S3MultipartUploadPage): UploadsMarker | null =>
   page.nextKeyMarker
      ? {
           keyMarker: page.nextKeyMarker,
           uploadIdMarker: page.nextUploadIdMarker,
        }
      : null;

const useMultipartUploads = (
   serverId: string,
   bucketName: string,
   prefix: string,
   enabled = true
) => {
   const userId = useUserId();

   const { items: uploads, ...query } = useCursorQuery({
      queryKey: queryKeys.multipartUploads(
         userId,
         serverId,
         bucketName,
         prefix
      ),
      queryFn: (marker, signal) =>
         api.get<S3MultipartUploadPage>(
            `${multipartUploadsPath(serverId, bucketName)}${qs({
               prefix,
               keyMarker: marker?.keyMarker,
               uploadIdMarker: marker?.uploadIdMarker,
            })}`,
            signal
         ),
      select: pageUploads,
      nextCursor: nextMarker,
      enabled: enabled && Boolean(userId && serverId && bucketName),
      retry: false,
      // uploads fail and finish outside this list, so each opening reads it afresh
      staleTime: 0,
   });

   return { uploads, ...query };
};

export default useMultipartUploads;
export type { UploadsMarker };
