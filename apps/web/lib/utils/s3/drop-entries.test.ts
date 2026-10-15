import { afterEach, describe, expect, it, vi } from "vitest";

type FileResolve = (file: File) => void;
type EntriesResolve = (entries: FakeEntry[]) => void;

type FakeFileEntry = {
   isFile: true;
   isDirectory: false;
   fullPath: string;
   file: (resolve: FileResolve) => void;
};

type FakeDirEntry = {
   isFile: false;
   isDirectory: true;
   fullPath: string;
   createReader: () => { readEntries: (resolve: EntriesResolve) => void };
};

type FakeEntry = FakeFileEntry | FakeDirEntry;

const fileEntry = (path: string): FakeFileEntry => ({
   isFile: true,
   isDirectory: false,
   fullPath: path,
   file: (resolve) => {
      resolve(new File(["x"], path.split("/").pop() ?? path));
   },
});

const dirEntry = (
   path: string,
   children: FakeEntry[],
   pageSize = 100
): FakeDirEntry => {
   let index = 0;
   return {
      isFile: false,
      isDirectory: true,
      fullPath: path,
      createReader: () => ({
         readEntries: (resolve) => {
            const page = children.slice(index, index + pageSize);
            index += page.length;
            resolve(page);
         },
      }),
   };
};

const dataTransferFor = (entries: FakeEntry[]): DataTransfer =>
   ({
      items: entries.map((entry) => ({
         kind: "file",
         webkitGetAsEntry: () => entry as unknown as FileSystemEntry,
      })),
      files: [] as unknown as FileList,
   }) as unknown as DataTransfer;

const trackBrowserOperations = (limit = Infinity) => {
   const stats = {
      pending: 0,
      maxPending: 0,
      openedFiles: 0,
      completedFiles: 0,
      drainedDirectories: 0,
      startedAfterLimit: 0,
   };
   const schedule = (complete: () => void) => {
      if (stats.completedFiles > limit) stats.startedAfterLimit++;
      stats.pending++;
      stats.maxPending = Math.max(stats.maxPending, stats.pending);
      setTimeout(() => {
         stats.pending--;
         complete();
      }, 0);
   };
   const wrap = (entry: FakeEntry): FakeEntry =>
      entry.isFile
         ? {
              ...entry,
              file: (resolve) => {
                 stats.openedFiles++;
                 schedule(() => {
                    stats.completedFiles++;
                    entry.file(resolve);
                 });
              },
           }
         : {
              ...entry,
              createReader: () => {
                 const reader = entry.createReader();
                 return {
                    readEntries: (resolve) =>
                       schedule(() =>
                          reader.readEntries((children) => {
                             if (children.length === 0)
                                stats.drainedDirectories++;
                             resolve(children.map(wrap));
                          })
                       ),
                 };
              },
           };
   return { stats, wrap };
};

const { filesFromDrop, fromFileList } = await import("./drop-entries");

afterEach(() => vi.useRealTimers());

describe("filesFromDrop", () => {
   it("preserves traversal order regardless of which file resolves first", async () => {
      vi.useFakeTimers();
      const order: string[] = [];
      const slowFile = (path: string, delay: number): FakeFileEntry => ({
         isFile: true,
         isDirectory: false,
         fullPath: path,
         file: (resolve) => {
            setTimeout(() => {
               order.push(path);
               resolve(new File(["x"], path.split("/").pop() ?? path));
            }, delay);
         },
      });
      const tree = dirEntry("/root", [
         slowFile("/root/a.txt", 30),
         slowFile("/root/b.txt", 10),
         dirEntry("/root/sub", [slowFile("/root/sub/c.txt", 20)]),
      ]);
      const result = filesFromDrop(dataTransferFor([tree]));
      await vi.runAllTimersAsync();
      const files = await result;
      expect(order).toEqual(["/root/b.txt", "/root/sub/c.txt", "/root/a.txt"]);
      expect(files.map((f) => f.relativePath)).toEqual([
         "root/a.txt",
         "root/b.txt",
         "root/sub/c.txt",
      ]);
   });

   it("bounds file and paginated directory callbacks across every dropped tree", async () => {
      vi.useFakeTimers();
      const { stats, wrap } = trackBrowserOperations();
      const paths: string[] = [];
      const roots = Array.from({ length: 4 }, (_, root) =>
         dirEntry(
            `/root${root}`,
            Array.from({ length: 4 }, (_, directory) => {
               const path = `/root${root}/dir${directory}`;
               return dirEntry(
                  path,
                  Array.from({ length: 25 }, (_, file) => {
                     const filePath = `${path}/f${file}.txt`;
                     paths.push(filePath.slice(1));
                     return fileEntry(filePath);
                  }),
                  10
               );
            }),
            2
         )
      );
      const result = filesFromDrop(dataTransferFor(roots.map(wrap)));
      await vi.runAllTimersAsync();
      const files = await result;
      expect(files.map((file) => file.relativePath)).toEqual(paths);
      expect(stats.maxPending).toBe(8);
      expect(stats.pending).toBe(0);
      expect(stats.drainedDirectories).toBe(20);
      expect(stats.completedFiles).toBe(400);
   });

   it("stops queued nested reads at the rejection threshold and drains active callbacks", async () => {
      vi.useFakeTimers();
      const limit = 20;
      const { stats, wrap } = trackBrowserOperations(limit);
      const roots = Array.from({ length: 8 }, (_, root) =>
         dirEntry(
            `/root${root}`,
            Array.from({ length: 8 }, (_, directory) => {
               const path = `/root${root}/dir${directory}`;
               return dirEntry(
                  path,
                  Array.from({ length: 64 }, (_, file) =>
                     fileEntry(`${path}/f${file}.txt`)
                  ),
                  10
               );
            })
         )
      );
      const result = filesFromDrop(dataTransferFor(roots.map(wrap)), limit);
      await vi.runAllTimersAsync();
      const files = await result;
      expect(files.length).toBeGreaterThan(limit);
      expect(files.length).toBeLessThanOrEqual(limit + 8);
      expect(stats.maxPending).toBe(8);
      expect(stats.startedAfterLimit).toBe(0);
      expect(stats.openedFiles).toBe(files.length);
      expect(stats.completedFiles).toBe(files.length);
      expect(stats.pending).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
   });

   it("walks a drop within the limit in full", async () => {
      const children = Array.from({ length: 100 }, (_, i) =>
         fileEntry(`/root/f${i}.txt`)
      );
      const tree = dirEntry("/root", children);
      const files = await filesFromDrop(dataTransferFor([tree]), 100);
      expect(files).toHaveLength(100);
   });

   it("falls back to the flat file list when entries aren't available", async () => {
      const file = new File(["x"], "a.txt");
      const dataTransfer = {
         items: [],
         files: [file] as unknown as FileList,
      } as unknown as DataTransfer;
      const files = await filesFromDrop(dataTransfer);
      expect(files).toEqual([{ file, relativePath: "a.txt" }]);
   });
});

describe("fromFileList", () => {
   it("uses webkitRelativePath when set, falling back to the plain name", () => {
      const plain = new File(["x"], "a.txt");
      const withPath = new File(["x"], "b.txt");
      Object.defineProperty(withPath, "webkitRelativePath", {
         value: "folder/b.txt",
      });
      const files = fromFileList([plain, withPath]);
      expect(files).toEqual([
         { file: plain, relativePath: "a.txt" },
         { file: withPath, relativePath: "folder/b.txt" },
      ]);
   });
});
