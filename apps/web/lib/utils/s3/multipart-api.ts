import { api, apiUrl, multipartUploadsPath, objectsPath, qs } from "@/lib/api";
import {
   MULTIPART_ABORT_PATH,
   MULTIPART_COMPLETE_PATH,
   MULTIPART_PART_CONTENT_TYPE,
   MULTIPART_PARTS_PATH,
   type S3MultipartCreated,
   type S3ObjectUploaded,
   type S3UploadedPart,
   type S3UploadedParts,
} from "@s3-viewer/types";
import { putBytes, type TransportHandle } from "./upload-transport";

type UploadTarget = {
   serverId: string;
   bucketName: string;
   objectKey: string;
};

type UploadRef = UploadTarget & { uploadId: string };

const createMultipartUpload = (
   userId: string,
   { serverId, bucketName, objectKey }: UploadTarget,
   details: { contentType: string; totalBytes: number; expectedETag?: string }
): Promise<S3MultipartCreated> =>
   api.post<S3MultipartCreated>(multipartUploadsPath(serverId, bucketName), {
      objectKey,
      expectedUserId: userId,
      ...details,
   });

const listUploadedParts = async ({
   serverId,
   bucketName,
   objectKey,
   uploadId,
}: UploadRef): Promise<S3UploadedPart[]> =>
   (
      await api.get<S3UploadedParts>(
         `${objectsPath(serverId, bucketName, MULTIPART_PARTS_PATH)}${qs({ objectKey, uploadId })}`
      )
   ).parts;

const completeMultipartUpload = (
   userId: string,
   { serverId, bucketName, objectKey, uploadId }: UploadRef,
   parts: readonly { partNumber: number; eTag: string }[],
   expectedETag?: string
): Promise<S3ObjectUploaded> =>
   api.post<S3ObjectUploaded>(
      objectsPath(serverId, bucketName, MULTIPART_COMPLETE_PATH),
      {
         objectKey,
         uploadId,
         parts,
         expectedETag,
         expectedUserId: userId,
      }
   );

const abortMultipartUpload = (
   userId: string,
   { serverId, bucketName, objectKey, uploadId }: UploadRef
): Promise<void> =>
   api.delete<void>(objectsPath(serverId, bucketName, MULTIPART_ABORT_PATH), {
      objectKey,
      uploadId,
      expectedUserId: userId,
   });

const putPart = (
   userId: string,
   { serverId, bucketName, objectKey, uploadId }: UploadRef,
   partNumber: number,
   body: Blob,
   onProgress: (loadedBytes: number) => void
): TransportHandle<S3UploadedPart> =>
   putBytes<S3UploadedPart>({
      url: apiUrl(
         `${objectsPath(serverId, bucketName, MULTIPART_PARTS_PATH)}${qs({
            objectKey,
            uploadId,
            partNumber,
            expectedUserId: userId,
         })}`
      ),
      body,
      contentType: MULTIPART_PART_CONTENT_TYPE,
      userId,
      onProgress,
   });

export {
   abortMultipartUpload,
   completeMultipartUpload,
   createMultipartUpload,
   listUploadedParts,
   putPart,
};
export type { UploadRef, UploadTarget };
