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

const LEASE_PREFIX = "s3-viewer.multipart-upload.";

const leaseName = (
   userId: string,
   { serverId, bucketName, objectKey }: UploadTarget
): string =>
   `${LEASE_PREFIX}${JSON.stringify([userId, serverId, bucketName, objectKey])}`;

const withMultipartLease = async <T>(
   userId: string,
   target: UploadTarget,
   operation: (persistent: boolean) => Promise<T>
): Promise<T> => {
   const locks = lockManager();
   if (!locks) return operation(false);
   let entered = false;
   try {
      return await locks.request(
         leaseName(userId, target),
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

// keys whose multipart upload some tab of this browser is still running under its lease
const leasedUploadKeys = async (
   userId: string,
   serverId: string,
   bucketName: string
): Promise<Set<string>> => {
   const locks = lockManager();
   if (!locks) return new Set();
   try {
      const { held = [] } = await locks.query();
      return new Set(
         held.flatMap(({ name }) => {
            if (!name?.startsWith(LEASE_PREFIX)) return [];
            const [user, server, bucket, key] = JSON.parse(
               name.slice(LEASE_PREFIX.length)
            ) as string[];
            return user === userId &&
               server === serverId &&
               bucket === bucketName &&
               key !== undefined
               ? [key]
               : [];
         })
      );
   } catch {
      return new Set();
   }
};

export { leasedUploadKeys, withMultipartLease, withMultipartStorageLock };
