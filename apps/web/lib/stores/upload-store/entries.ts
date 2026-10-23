import type { UploadEntry } from "./types";

const entryId = (serverId: string, bucketName: string, objectKey: string) =>
   JSON.stringify([serverId, bucketName, objectKey]);

const isOpen = (status: UploadEntry["status"]) =>
   status === "pending" || status === "active";

// a pending entry counts too: when it starts it resumes any multipart upload saved for its key
const openUploadKeys = (
   entries: Readonly<Record<string, UploadEntry>>,
   serverId: string,
   bucketName: string
): Set<string> =>
   new Set(
      Object.entries(entries).flatMap(([id, entry]) => {
         if (!isOpen(entry.status)) return [];
         const [server, bucket, key] = JSON.parse(id) as [
            string,
            string,
            string,
         ];
         return server === serverId && bucket === bucketName ? [key] : [];
      })
   );

export { entryId, isOpen, openUploadKeys };
