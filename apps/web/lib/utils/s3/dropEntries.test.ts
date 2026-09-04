import { describe, expect, it } from "vitest";

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

const fileEntry = (path: string, onOpen?: () => void): FakeFileEntry => ({
   isFile: true,
   isDirectory: false,
   fullPath: path,
   file: (resolve) => {
      onOpen?.();
      resolve(new File(["x"], path.split("/").pop() ?? path));
   },
});

// mirrors the real api: readEntries pages, and must be drained in a loop
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

const { filesFromDrop, fromFileList } = await import("./dropEntries");

describe("filesFromDrop", () => {
   it("walks nested folders and strips the leading slash from fullPath", async () => {
      const tree = dirEntry("/root", [
         fileEntry("/root/a.txt"),
         dirEntry("/root/sub", [fileEntry("/root/sub/b.txt")]),
      ]);
      const files = await filesFromDrop(dataTransferFor([tree]));
      expect(files.map((f) => f.relativePath)).toEqual([
         "root/a.txt",
         "root/sub/b.txt",
      ]);
   });

   it("preserves traversal order regardless of which file resolves first", async () => {
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
      const files = await filesFromDrop(dataTransferFor([tree]));
      expect(order).toEqual(["/root/b.txt", "/root/sub/c.txt", "/root/a.txt"]);
      expect(files.map((f) => f.relativePath)).toEqual([
         "root/a.txt",
         "root/b.txt",
         "root/sub/c.txt",
      ]);
   });

   it("drains a directory reader that pages at 100 entries per call", async () => {
      const children = Array.from({ length: 250 }, (_, i) =>
         fileEntry(`/root/f${i}.txt`)
      );
      const tree = dirEntry("/root", children, 100);
      const files = await filesFromDrop(dataTransferFor([tree]));
      expect(files).toHaveLength(250);
      expect(new Set(files.map((f) => f.relativePath)).size).toBe(250);
   });

   it("limits how many files are opened concurrently while walking", async () => {
      let active = 0;
      let maxActive = 0;
      const slowFile = (path: string): FakeFileEntry => ({
         isFile: true,
         isDirectory: false,
         fullPath: path,
         file: (resolve) => {
            active++;
            maxActive = Math.max(maxActive, active);
            setTimeout(() => {
               active--;
               resolve(new File(["x"], path));
            }, 0);
         },
      });
      const children = Array.from({ length: 20 }, (_, i) =>
         slowFile(`/root/f${i}.txt`)
      );
      const tree = dirEntry("/root", children);
      const files = await filesFromDrop(dataTransferFor([tree]));
      expect(files).toHaveLength(20);
      expect(maxActive).toBeLessThanOrEqual(8);
      expect(maxActive).toBeGreaterThan(1);
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
