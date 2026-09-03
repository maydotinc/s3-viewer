type UploadFile = { file: File; relativePath: string };

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

const walkEntry = async (entry: FileSystemEntry, out: UploadFile[]) => {
   if (entry.isFile) {
      const file = await fileFromEntry(entry as FileSystemFileEntry);
      out.push({ file, relativePath: entry.fullPath.replace(/^\//, "") });
      return;
   }
   if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      for (;;) {
         const batch = await readEntries(reader);
         if (batch.length === 0) break;
         for (const child of batch) await walkEntry(child, out);
      }
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
   const out: UploadFile[] = [];
   for (const entry of entries) {
      if (entry) await walkEntry(entry, out);
   }
   return out;
};

export { filesFromDrop, fromFileList };
export type { UploadFile };
