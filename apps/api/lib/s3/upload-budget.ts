import { ApiHttpError } from "@/lib/http";
import { ErrorCode } from "@s3-viewer/types";

export const UPLOAD_QUEUE_SIZE = 2;

// Reserve the queued parts plus working space for assembling/copying a part.
export const uploadMemoryFor = (partBytes: number): number =>
   (UPLOAD_QUEUE_SIZE + 2) * partBytes;

type UploadBudgetOptions = {
   maxUploads: number;
   maxPerUser: number;
   maxBytes: number;
};

export const createUploadBudget = ({
   maxUploads,
   maxPerUser,
   maxBytes,
}: UploadBudgetOptions) => {
   let active = 0;
   let bytes = 0;
   const users = new Map<string, number>();
   return {
      acquire(userId: string, reservation: number): () => void {
         if (reservation > maxBytes)
            throw new ApiHttpError(
               413,
               "This upload needs more buffer memory than this instance allows"
            );
         const held = users.get(userId) ?? 0;
         if (
            active >= maxUploads ||
            held >= maxPerUser ||
            bytes + reservation > maxBytes
         ) {
            throw new ApiHttpError(
               429,
               "Upload capacity is busy. Try again shortly.",
               ErrorCode.RATE_LIMITED
            );
         }
         active++;
         bytes += reservation;
         users.set(userId, held + 1);
         let released = false;
         return () => {
            if (released) return;
            released = true;
            active--;
            bytes -= reservation;
            const remaining = (users.get(userId) ?? 1) - 1;
            if (remaining) users.set(userId, remaining);
            else users.delete(userId);
         };
      },
   };
};
