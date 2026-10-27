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
): ReadonlySet<string> => {
   // ids are JSON arrays, so the scope's opening is an exact prefix and no id needs parsing
   const scope = `${JSON.stringify([serverId, bucketName]).slice(0, -1)},`;
   const keys = new Set<string>();
   for (const [id, entry] of Object.entries(entries))
      if (isOpen(entry.status) && id.startsWith(scope))
         keys.add(entry.objectKey);
   return keys;
};

export { entryId, isOpen, openUploadKeys };
