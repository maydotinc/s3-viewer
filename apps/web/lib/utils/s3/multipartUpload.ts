import { createApiRequest, handleApiError } from "@/lib/utils/api";

const MULTIPART_THRESHOLD = 50 * 1024 * 1024; // 50MB
const PART_SIZE = 25 * 1024 * 1024; // 25MB

interface MultipartUploadResponse {
   uploadId: string;
   bucketName: string;
   objectKey: string;
   message: string;
}

interface PartPresignedUrlResponse {
   url: string;
   uploadId: string;
   partNumber: number;
   message: string;
}

interface CompleteMultipartResponse {
   location: string;
   bucketName: string;
   objectKey: string;
   etag: string;
   message: string;
}

const createMultipartUpload = async (
   bucketName: string,
   objectKey: string,
   contentType: string,
   serverId: string
): Promise<MultipartUploadResponse> => {
   const response = await createApiRequest("/s3/object/multipart/create", {
      method: "POST",
      body: JSON.stringify({
         bucketName,
         objectKey,
         contentType,
         serverId,
      }),
   });

   if (!response.ok) {
      await handleApiError(response);
   }

   return await response.json();
};

const getPartPresignedUrl = async (
   uploadId: string,
   partNumber: number,
   bucketName: string,
   objectKey: string,
   serverId: string
): Promise<PartPresignedUrlResponse> => {
   const params = new URLSearchParams({
      bucketName,
      objectKey,
      serverId,
   });

   const response = await createApiRequest(
      `/s3/object/multipart/${uploadId}/part/${partNumber}/presigned-url?${params}`,
      {
         method: "GET",
      }
   );

   if (!response.ok) {
      await handleApiError(response);
   }

   return await response.json();
};

const uploadPart = (
   presignedUrl: string,
   partData: Blob,
   onProgress?: (progress: number) => void
) => {
   let xhr: XMLHttpRequest;

   const upload = (): Promise<{
      success: boolean;
      error?: string;
   }> => {
      return new Promise((resolve) => {
         xhr = new XMLHttpRequest();

         if (onProgress) {
            xhr.upload.onprogress = (event) => {
               if (event.lengthComputable) {
                  const progress = (event.loaded / event.total) * 100;
                  onProgress(progress);
               }
            };
         }

         xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
               resolve({ success: true });
            } else {
               resolve({
                  success: false,
                  error: `Part upload failed (${xhr.status})`,
               });
            }
         };

         xhr.onerror = () =>
            resolve({ success: false, error: "Part upload failed" });
         xhr.onabort = () =>
            resolve({ success: false, error: "Part upload cancelled" });

         xhr.open("PUT", presignedUrl);
         xhr.send(partData);
      });
   };

   const cancel = () => {
      if (xhr && xhr.readyState !== XMLHttpRequest.DONE) {
         xhr.abort();
      }
   };

   return { upload, cancel };
};

const completeMultipartUpload = async (
   uploadId: string,
   bucketName: string,
   objectKey: string,
   serverId: string
): Promise<CompleteMultipartResponse> => {
   const response = await createApiRequest(
      `/s3/object/multipart/${uploadId}/complete`,
      {
         method: "POST",
         body: JSON.stringify({
            bucketName,
            objectKey,
            serverId,
         }),
      }
   );

   if (!response.ok) {
      await handleApiError(response);
   }

   return await response.json();
};

const abortMultipartUpload = async (
   uploadId: string,
   bucketName: string,
   objectKey: string,
   serverId: string
): Promise<void> => {
   const response = await createApiRequest(
      `/s3/object/multipart/${uploadId}/abort`,
      {
         method: "DELETE",
         body: JSON.stringify({
            bucketName,
            objectKey,
            serverId,
         }),
      }
   );

   if (!response.ok) {
      await handleApiError(response);
   }
};

const splitFileIntoParts = (file: File): Blob[] => {
   const parts: Blob[] = [];
   let offset = 0;

   while (offset < file.size) {
      const end = Math.min(offset + PART_SIZE, file.size);
      parts.push(file.slice(offset, end));
      offset = end;
   }

   return parts;
};

const uploadFileMultipart = (
   file: File,
   bucketName: string,
   objectKey: string,
   serverId: string,
   onProgress?: (progress: number) => void
) => {
   let uploadId: string | null = null;
   let partCancelFunctions: (() => void)[] = [];

   const upload = async (): Promise<{ success: boolean; error?: string }> => {
      try {
         const multipartResponse = await createMultipartUpload(
            bucketName,
            objectKey,
            file.type,
            serverId
         );
         uploadId = multipartResponse.uploadId;

         const parts = splitFileIntoParts(file);
         const partProgress: number[] = new Array(parts.length).fill(0);

         const updateOverallProgress = () => {
            const totalProgress = partProgress.reduce(
               (sum, progress) => sum + progress,
               0
            );
            const overallProgress = totalProgress / parts.length;
            onProgress?.(overallProgress);
         };

         const partUploadPromises = parts.map(async (part, index) => {
            const partNumber = index + 1;

            const presignedResponse = await getPartPresignedUrl(
               uploadId!,
               partNumber,
               bucketName,
               objectKey,
               serverId
            );

            const { upload: partUpload, cancel: partCancel } = uploadPart(
               presignedResponse.url,
               part,
               (progress: number) => {
                  partProgress[index] = progress;
                  updateOverallProgress();
               }
            );

            partCancelFunctions.push(partCancel);

            const partResult = await partUpload();

            if (!partResult.success) {
               throw new Error(
                  partResult.error || `Part ${partNumber} upload failed`
               );
            }

            return { partNumber, success: true };
         });

         // Wait for all parts to complete
         await Promise.all(partUploadPromises);

         // Complete multipart upload - S3 will auto-assemble by part number
         await completeMultipartUpload(
            uploadId,
            bucketName,
            objectKey,
            serverId
         );

         return { success: true };
      } catch (error) {
         if (uploadId) {
            try {
               console.log(
                  "Upload failed, aborting multipart upload",
                  uploadId
               );
               await abortMultipartUpload(
                  uploadId,
                  bucketName,
                  objectKey,
                  serverId
               );
            } catch (abortError) {
               console.error("Failed to abort multipart upload:", abortError);
            }
         }

         if (error instanceof Error) {
            return { success: false, error: error.message };
         }
         return { success: false, error: "Multipart upload failed" };
      }
   };

   const cancel = async () => {
      partCancelFunctions.forEach((cancelFn) => cancelFn());

      if (uploadId) {
         try {
            await abortMultipartUpload(
               uploadId,
               bucketName,
               objectKey,
               serverId
            );
         } catch (error) {
            console.error("Failed to abort multipart upload:", error);
         }
      }
   };

   return { upload, cancel };
};

export { MULTIPART_THRESHOLD, PART_SIZE, uploadFileMultipart };
