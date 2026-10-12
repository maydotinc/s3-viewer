import { yieldToEventLoop } from "@/lib/utils/yield-to-event-loop";
import { mapLimit } from "@s3-viewer/types";

const WALK_CONCURRENCY = 8;
const WALK_YIELD_EVERY = 200;
const MAX_UPLOAD_FILES = 10000;

type UploadFile = { file: File; relativePath: string };

type Walk = {
   onFile: () => boolean;
   full: () => boolean;
   read: <T>(operation: () => Promise<T>) => Promise<T | undefined>;
};

const fromFileList = (files: ArrayLike<File>): UploadFile[] =>
   Array.from(files).map((file) => ({
      file,
      relativePath: file.webkitRelativePath || file.name,
   }));

const readEntries = (reader: FileSystemDirectoryReader) =>
   new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject)
   );

const fileFromEntry = (entry: FileSystemFileEntry) =>
   new Promise<File>((resolve, reject) => entry.file(resolve, reject));

const walkEntry = async (
   entry: FileSystemEntry,
   walk: Walk
): Promise<UploadFile[]> => {
   if (walk.full()) return [];
   if (entry.isFile) {
      let shouldYield = false;
      const file = await walk.read(async () => {
         const file = await fileFromEntry(entry as FileSystemFileEntry);
         shouldYield = walk.onFile();
         return file;
      });
      if (!file) return [];
      if (shouldYield) await yieldToEventLoop();
      return [{ file, relativePath: entry.fullPath.replace(/^\//, "") }];
   }
   if (!entry.isDirectory) return [];
   const reader = (entry as FileSystemDirectoryEntry).createReader();
   const out: UploadFile[] = [];
   // readEntries returns at most 100 entries per call, so keep reading until it returns none
   while (!walk.full()) {
      const batch = await walk.read(() => readEntries(reader));
      if (!batch || batch.length === 0) break;
      for (const files of await mapLimit(batch, WALK_CONCURRENCY, (child) =>
         walkEntry(child, walk)
      ))
         out.push(...files);
   }
   return out;
};

const filesFromDrop = async (
   dataTransfer: DataTransfer,
   limit = MAX_UPLOAD_FILES
): Promise<UploadFile[]> => {
   const items = Array.from(dataTransfer.items ?? []);
   const entries = items
      .filter((item) => item.kind === "file")
      .map((item) =>
         typeof item.webkitGetAsEntry === "function"
            ? item.webkitGetAsEntry()
            : null
      );
   if (entries.length === 0 || entries.some((entry) => entry === null)) {
      return fromFileList(dataTransfer.files);
   }
   let seen = 0;
   let sinceYield = 0;
   let activeReads = 0;
   const waitingReads: (() => void)[] = [];
   const walk: Walk = {
      full: () => seen > limit,
      onFile: () => {
         seen++;
         sinceYield++;
         if (sinceYield >= WALK_YIELD_EVERY) {
            sinceYield = 0;
            return true;
         }
         return false;
      },
      read: async <T>(operation: () => Promise<T>) => {
         if (walk.full()) return undefined;
         if (activeReads === WALK_CONCURRENCY) {
            await new Promise<void>((resolve) => waitingReads.push(resolve));
         } else {
            activeReads++;
         }
         try {
            if (walk.full()) return undefined;
            return await operation();
         } finally {
            const next = waitingReads.shift();
            if (next) next();
            else activeReads--;
         }
      },
   };
   const walked = await mapLimit(
      entries.flatMap((entry) => (entry ? [entry] : [])),
      WALK_CONCURRENCY,
      (entry) => walkEntry(entry, walk)
   );
   return walked.flat();
};

export { MAX_UPLOAD_FILES, filesFromDrop, fromFileList };
export type { UploadFile };
