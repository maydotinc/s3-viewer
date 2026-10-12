import type { UploadTarget } from "./multipart-api";

const lockManager = (): LockManager | null => {
   try {
      return typeof navigator === "undefined"
         ? null
         : (navigator.locks ?? null);
   } catch {
      return null;
   }
};

const withMultipartStorageLock = async <T>(
   fallback: T,
   operation: () => T
): Promise<T> => {
   try {
      const locks = lockManager();
      if (!locks) return fallback;
      return await locks.request("s3-viewer.multipart-storage", operation);
   } catch {
      return fallback;
   }
};

const withMultipartLease = async <T>(
   userId: string,
   { serverId, bucketName, objectKey }: UploadTarget,
   operation: (persistent: boolean) => Promise<T>
): Promise<T> => {
   const locks = lockManager();
   if (!locks) return operation(false);
   let entered = false;
   try {
      return await locks.request(
         `s3-viewer.multipart-upload.${JSON.stringify([userId, serverId, bucketName, objectKey])}`,
         { ifAvailable: true },
         async (lock) => {
            entered = true;
            return operation(lock !== null);
         }
      );
   } catch (error) {
      if (entered) throw error;
      return operation(false);
   }
};

export { withMultipartLease, withMultipartStorageLock };
