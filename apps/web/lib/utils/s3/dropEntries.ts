import { mapLimit } from "@s3-viewer/types";

const WALK_CONCURRENCY = 8;
const WALK_YIELD_EVERY = 200;

type UploadFile = { file: File; relativePath: string };

const fromFileList = (files: ArrayLike<File>): UploadFile[] =>
   Array.from(files).map((file) => ({
      file,
      relativePath: file.webkitRelativePath || file.name,
   }));

const yieldToEventLoop = () =>
   new Promise<void>((resolve) => setTimeout(resolve, 0));

// `readEntries` hands back at most 100 entries per call; drain it in a loop
const readEntries = (reader: FileSystemDirectoryReader) =>
   new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject)
   );

const fileFromEntry = (entry: FileSystemFileEntry) =>
   new Promise<File>((resolve, reject) => entry.file(resolve, reject));

const walkEntry = async (
   entry: FileSystemEntry,
   onFile: () => void | Promise<void>
): Promise<UploadFile[]> => {
   if (entry.isFile) {
      const file = await fileFromEntry(entry as FileSystemFileEntry);
      await onFile();
      return [{ file, relativePath: entry.fullPath.replace(/^\//, "") }];
   }
   if (!entry.isDirectory) return [];
   const reader = (entry as FileSystemDirectoryEntry).createReader();
   const out: UploadFile[] = [];
   for (;;) {
      const batch = await readEntries(reader);
      if (batch.length === 0) return out;
      for (const files of await mapLimit(batch, WALK_CONCURRENCY, (child) =>
         walkEntry(child, onFile)
      ))
         out.push(...files);
   }
};

const filesFromDrop = async (
   dataTransfer: DataTransfer
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
   let sinceYield = 0;
   const onFile = async () => {
      sinceYield++;
      if (sinceYield >= WALK_YIELD_EVERY) {
         sinceYield = 0;
         await yieldToEventLoop();
      }
   };
   const walked = await mapLimit(
      entries.flatMap((entry) => (entry ? [entry] : [])),
      WALK_CONCURRENCY,
      (entry) => walkEntry(entry, onFile)
   );
   return walked.flat();
};

export { filesFromDrop, fromFileList };
export type { UploadFile };
