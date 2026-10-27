import { S3_ROUTE_TIMEOUT_MS } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { listing, reply, s3Fixture } from "@/lib/testing/s3-fixture";
import { EXISTS_LIST_THRESHOLD } from "../listing";
import { describe, expect, it, vi } from "vitest";
import {
   MAX_CONCURRENT_COLLECTIONS,
   archiveFilename,
   collectArchiveEntries,
   listingBounds,
} from "./entries";

const limits = { maxObjects: 100, maxBytes: 1_000_000 };

describe("archive entry collection", () => {
   it.each([7, undefined])(
      "refuses slash-ending objects of size %s before streaming",
      async (size) => {
         const f = s3Fixture(async () => listing([]));
         vi.spyOn(f.client, "send").mockImplementation(async () => ({
            $metadata: {},
            Contents: [
               { Key: "raw/data/", Size: size },
               { Key: "raw/file", Size: 1 },
            ],
         }));
         try {
            await expect(
               collectArchiveEntries(f.scope, ["raw/"], limits)
            ).rejects.toMatchObject({
               kind: "conflict",
               message: expect.stringContaining(
                  "ZIP downloads cannot represent it safely"
               ),
            });
         } finally {
            f.client.destroy();
         }
      }
   );

   it("expands a folder, drops its marker and keeps the shared path", async () => {
      const f = s3Fixture(async (request) => {
         expect(request.query["list-type"]).toBe("2");
         expect(decodeURIComponent(request.query.prefix ?? "")).toBe(
            "logs/2026/"
         );
         return listing([
            { key: "logs/2026/", size: 0 },
            { key: "logs/2026/a.txt", size: 5 },
            { key: "logs/2026/nested/b.txt", size: 7 },
         ]);
      });
      try {
         expect(
            await collectArchiveEntries(f.scope, ["logs/2026/"], limits)
         ).toEqual({
            bytes: 12,
            fileSizes: new Map(),
            entries: [
               { key: "logs/2026/a.txt", name: "2026/a.txt", size: 5 },
               {
                  key: "logs/2026/nested/b.txt",
                  name: "2026/nested/b.txt",
                  size: 7,
               },
            ],
         });
      } finally {
         f.client.destroy();
      }
   });

   it("skips listed keys outside the folder when a gateway ignores the prefix", async () => {
      const f = s3Fixture(async () =>
         listing([
            { key: "logs/2026/a.txt", size: 5 },
            { key: "private/secret.txt", size: 9 },
            { key: "logs/2027/b.txt", size: 7 },
         ])
      );
      try {
         const { entries, bytes } = await collectArchiveEntries(
            f.scope,
            ["logs/2026/"],
            limits
         );
         expect(entries.map(({ key }) => key)).toEqual(["logs/2026/a.txt"]);
         expect(bytes).toBe(5);
      } finally {
         f.client.destroy();
      }
   });

   it("follows continuation tokens and heads plain file keys for their size", async () => {
      const f = s3Fixture(async (request) => {
         if (request.method === "HEAD")
            return reply(200, "", { "content-length": "3" });
         return request.query["continuation-token"]
            ? listing([{ key: "logs/b.txt", size: 4 }])
            : listing([{ key: "logs/a.txt", size: 2 }], "next");
      });
      try {
         const { entries, bytes } = await collectArchiveEntries(
            f.scope,
            ["logs/", "notes.md"],
            limits
         );
         expect(entries.map(({ name }) => name)).toEqual([
            "logs/a.txt",
            "logs/b.txt",
            "notes.md",
         ]);
         expect(bytes).toBe(9);
         expect(f.requests.filter((r) => r.method === "HEAD")).toHaveLength(1);
      } finally {
         f.client.destroy();
      }
   });

   it("reuses the sizes it is given instead of heading those files again", async () => {
      const f = s3Fixture(async () =>
         listing([{ key: "logs/a.txt", size: 2 }])
      );
      try {
         const { entries, bytes, fileSizes } = await collectArchiveEntries(
            f.scope,
            ["logs/", "notes.md"],
            limits,
            new Map([["notes.md", 3]])
         );
         expect(entries).toEqual([
            { key: "logs/a.txt", name: "logs/a.txt", size: 2 },
            { key: "notes.md", name: "notes.md", size: 3 },
         ]);
         expect(bytes).toBe(5);
         expect(fileSizes).toEqual(new Map([["notes.md", 3]]));
         expect(f.requests.every(({ method }) => method !== "HEAD")).toBe(true);
      } finally {
         f.client.destroy();
      }
   });

   it("sizes a crowded selection from one listing and heads only what it missed", async () => {
      const files = Array.from(
         { length: EXISTS_LIST_THRESHOLD + 2 },
         (_, i) => `logs/f${String(i).padStart(2, "0")}`
      );
      const f = s3Fixture(async (request) => {
         if (request.method === "HEAD") return reply(404, "");
         return listing(files.slice(1).map((key) => ({ key, size: 2 })));
      });
      try {
         const { bytes, fileSizes } = await collectArchiveEntries(
            f.scope,
            files.slice(1),
            limits
         );
         expect(bytes).toBe(2 * (EXISTS_LIST_THRESHOLD + 1));
         expect(fileSizes.size).toBe(EXISTS_LIST_THRESHOLD + 1);
         expect(f.requests).toHaveLength(1);
         expect(decodeURIComponent(f.requests[0]?.query.prefix ?? "")).toBe(
            "logs/f"
         );

         f.requests.length = 0;
         await expect(
            collectArchiveEntries(f.scope, files, limits)
         ).rejects.toMatchObject({ kind: "notFound" });
         expect(f.requests.filter((r) => r.method === "HEAD")).toEqual([
            expect.objectContaining({ path: expect.stringContaining("f00") }),
         ]);
      } finally {
         f.client.destroy();
      }
   });

   it("counts carried sizes against the byte cap", async () => {
      const f = s3Fixture(async () => listing([]));
      try {
         await expect(
            collectArchiveEntries(
               f.scope,
               ["big.bin"],
               { maxObjects: 10, maxBytes: 1_000 },
               new Map([["big.bin", 5_000]])
            )
         ).rejects.toMatchObject({ kind: "tooLarge" });
         expect(f.requests).toHaveLength(0);
      } finally {
         f.client.destroy();
      }
   });

   it("refuses a selection over the object cap before any streaming", async () => {
      const f = s3Fixture(async () =>
         listing([
            { key: "logs/a.txt", size: 1 },
            { key: "logs/b.txt", size: 1 },
            { key: "logs/c.txt", size: 1 },
         ])
      );
      try {
         await expect(
            collectArchiveEntries(f.scope, ["logs/"], {
               maxObjects: 2,
               maxBytes: 1_000,
            })
         ).rejects.toMatchObject({
            kind: "tooLarge",
            message: expect.stringContaining("2 files"),
         });
      } finally {
         f.client.destroy();
      }
   });

   it("refuses a selection over the byte cap", async () => {
      const f = s3Fixture(async () =>
         listing([
            { key: "logs/a.txt", size: 600 },
            { key: "logs/b.txt", size: 600 },
         ])
      );
      try {
         await expect(
            collectArchiveEntries(f.scope, ["logs/"], {
               maxObjects: 10,
               maxBytes: 1_000,
            })
         ).rejects.toMatchObject({ kind: "tooLarge" });
      } finally {
         f.client.destroy();
      }
   });

   it("keeps a traversing key inside the archive", async () => {
      const f = s3Fixture(async () =>
         listing([
            { key: "dir/../../../../.ssh/authorized_keys", size: 3 },
            { key: "dir/..", size: 1 },
            { key: "dir/ok.txt", size: 2 },
         ])
      );
      try {
         const { entries } = await collectArchiveEntries(
            f.scope,
            ["dir/", "/etc/passwd"],
            limits,
            new Map([["/etc/passwd", 4]])
         );
         expect(entries.map(({ name }) => name)).toEqual([
            "authorized_keys",
            "file",
            "dir/ok.txt",
            "etc/passwd",
         ]);
      } finally {
         f.client.destroy();
      }
   });

   it("treats a backslash as a separator the way archiver does", async () => {
      const f = s3Fixture(async () =>
         listing([
            { key: "docs/..\\..\\..\\..\\tmp\\pwned", size: 1 },
            { key: "docs/nested\\report.txt", size: 2 },
         ])
      );
      try {
         const { entries } = await collectArchiveEntries(
            f.scope,
            ["docs/"],
            limits
         );
         expect(entries.map(({ name }) => name)).toEqual([
            "pwned",
            "docs/nested/report.txt",
         ]);
      } finally {
         f.client.destroy();
      }
   });

   it("normalizes interior segments and keeps colliding names apart", async () => {
      const f = s3Fixture(async () =>
         listing([
            { key: "logs/2026//a.txt", size: 1 },
            { key: "logs/2026/./b.txt", size: 1 },
            { key: "logs/2026/b.txt", size: 1 },
            { key: "logs/2026/nested/../c.txt", size: 1 },
         ])
      );
      try {
         const { entries } = await collectArchiveEntries(
            f.scope,
            ["logs/2026/"],
            limits
         );
         expect(entries.map(({ name }) => name)).toEqual([
            "2026/a.txt",
            "2026/b.txt",
            "2026/b.txt.2",
            "2026/c.txt",
         ]);
      } finally {
         f.client.destroy();
      }
   });

   it("keeps names that differ only by case apart, since common desktops extract them to one path", async () => {
      const f = s3Fixture(async () =>
         listing([
            { key: "logs/Report.pdf", size: 1 },
            { key: "logs/report.pdf", size: 1 },
            { key: "logs/A", size: 1 },
            { key: "logs/a/x.txt", size: 1 },
         ])
      );
      try {
         const { entries } = await collectArchiveEntries(
            f.scope,
            ["logs/"],
            limits
         );
         expect(entries.map(({ name }) => name)).toEqual([
            "logs/Report.pdf",
            "logs/report.pdf.2",
            "logs/A.2",
            "logs/a/x.txt",
         ]);
      } finally {
         f.client.destroy();
      }
   });

   it("keeps real suffix names distinct before and after generated collisions", async () => {
      const f = s3Fixture(async () =>
         listing([
            { key: "logs/file.2", size: 1 },
            { key: "logs/file", size: 1 },
            { key: "logs/a/../file", size: 1 },
            { key: "logs/file.3", size: 1 },
            { key: "logs/b/../file", size: 1 },
            { key: "logs/c/../file.3", size: 1 },
         ])
      );
      try {
         const { entries } = await collectArchiveEntries(
            f.scope,
            ["logs/"],
            limits
         );
         expect(entries.map(({ name }) => name)).toEqual([
            "logs/file.2",
            "logs/file",
            "logs/file.3",
            "logs/file.3.2",
            "logs/file.4",
            "logs/file.3.3",
         ]);
      } finally {
         f.client.destroy();
      }
   });

   it("names 2,000 normalized collisions with linear candidate lookups", async () => {
      const count = 2_000;
      const f = s3Fixture(async () => listing([]));
      let page = 0;
      vi.spyOn(f.client, "send").mockImplementation(async () => ({
         $metadata: {},
         Contents: Array.from({ length: 1_000 }, (_, index) => ({
            Key: `dir/${page * 1_000 + index}/../../file`,
            Size: 1,
         })),
         IsTruncated: ++page < count / 1_000,
         NextContinuationToken: String(page),
      }));
      const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
      const originalHas = Set.prototype.has;
      let lookups = 0;
      const has = vi.spyOn(Set.prototype, "has").mockImplementation(function (
         this: Set<unknown>,
         candidate: unknown
      ) {
         if (
            typeof candidate === "string" &&
            /^file(?:\.\d+)?$/.test(candidate)
         ) {
            if (++lookups > count * 3)
               throw new Error("Archive collision naming exceeded linear work");
         }
         return originalHas.call(this, candidate);
      });
      try {
         const { entries } = await collectArchiveEntries(f.scope, ["dir/"], {
            maxObjects: count,
            maxBytes: count,
         });
         has.mockRestore();
         expect(entries.map(({ name }) => name)).toEqual(
            Array.from({ length: count }, (_, index) =>
               index === 0 ? "file" : `file.${index + 1}`
            )
         );
         expect(new Set(entries.map(({ name }) => name)).size).toBe(count);
         expect(lookups).toBeLessThanOrEqual(count * 3);
         expect(page).toBe(count / 1_000);
         expect(warn).toHaveBeenCalledOnce();
         expect(warn).toHaveBeenCalledWith(
            "Zip entry names rewritten to stay inside the archive",
            { count, firstKey: expect.any(String) }
         );
      } finally {
         has.mockRestore();
         warn.mockRestore();
         f.client.destroy();
      }
   });

   it("learns 2,000 deeply nested paths with one directory lookup per entry", async () => {
      const count = 2_000;
      const depth = 500;
      const deep = `x/${"a/".repeat(depth)}`;
      const f = s3Fixture(async () => listing([]));
      let page = 0;
      vi.spyOn(f.client, "send").mockImplementation(async () => ({
         $metadata: {},
         Contents: Array.from({ length: 1_000 }, (_, index) => ({
            Key: `${deep}f${String(page * 1_000 + index).padStart(10, "0")}`,
            Size: 0,
         })),
         IsTruncated: ++page < count / 1_000,
         NextContinuationToken: String(page),
      }));
      const originalHas = Set.prototype.has;
      let lookups = 0;
      const has = vi.spyOn(Set.prototype, "has").mockImplementation(function (
         this: Set<unknown>,
         candidate: unknown
      ) {
         if (typeof candidate === "string" && /^x(?:\/a)+$/.test(candidate)) {
            if (++lookups > count + depth)
               throw new Error("Archive directory walk exceeded linear work");
         }
         return originalHas.call(this, candidate);
      });
      try {
         const { entries } = await collectArchiveEntries(f.scope, ["x/"], {
            maxObjects: count,
            maxBytes: count,
         });
         has.mockRestore();
         expect(entries).toHaveLength(count);
         expect(entries[0]?.name).toBe(`${deep}f0000000000`);
         expect(lookups).toBeLessThanOrEqual(count + depth);
      } finally {
         has.mockRestore();
         f.client.destroy();
      }
   });

   it("says nothing when every entry keeps its name", async () => {
      const f = s3Fixture(async () =>
         listing([
            { key: "logs/a.txt", size: 2 },
            { key: "logs/b.txt", size: 3 },
         ])
      );
      const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
      try {
         await collectArchiveEntries(f.scope, ["logs/"], limits);
         expect(warn).not.toHaveBeenCalled();
      } finally {
         warn.mockRestore();
         f.client.destroy();
      }
   });

   it("rejects an empty selection", async () => {
      const f = s3Fixture(async () => listing([]));
      try {
         await expect(
            collectArchiveEntries(f.scope, ["empty/"], limits)
         ).rejects.toMatchObject({ kind: "notFound" });
      } finally {
         f.client.destroy();
      }
   });

   it("lists selected folders together but keeps the selection's order", async () => {
      const others = Promise.withResolvers<void>();
      let started = 0;
      const contents: Record<string, { key: string; size: number }[]> = {
         "a/": [
            { key: "a/1", size: 1 },
            { key: "a/deep/2", size: 1 },
         ],
         "b/": [{ key: "b/3", size: 1 }],
         "a/deep/": [{ key: "a/deep/2", size: 1 }],
      };
      const f = s3Fixture(async (request) => {
         const prefix = decodeURIComponent(request.query.prefix ?? "");
         if (++started === 3) others.resolve();
         // the first folder answers last, so a sequential walk would never get past it.
         if (prefix === "a/") {
            await others.promise;
            await new Promise((resolve) => setTimeout(resolve, 10));
         }
         return listing(contents[prefix] ?? []);
      });
      try {
         const { entries } = await collectArchiveEntries(
            f.scope,
            ["a/", "b/", "a/deep/"],
            limits
         );
         expect(entries.map(({ key }) => key)).toEqual([
            "a/1",
            "a/deep/2",
            "b/3",
         ]);
      } finally {
         f.client.destroy();
      }
   });

   it("names the zip after a single folder and after the bucket otherwise", () => {
      expect(archiveFilename("bucket", ["logs/2026/"])).toBe("2026.zip");
      expect(archiveFilename("bucket", ["a.txt", "b.txt"])).toBe("bucket.zip");
   });
});

describe("archive collection bounds", () => {
   it.each([
      { Contents: [] },
      { Contents: [{ Key: "logs/", Size: 0 }] },
      { Contents: [{ Key: "logs/a", Size: 1 }] },
   ])(
      "bounds fresh pages even when their entries add no output",
      async ({ Contents }) => {
         const f = s3Fixture(async () => listing([]));
         let pages = 0;
         const send = vi
            .spyOn(f.client, "send")
            .mockImplementation(async () => ({
               $metadata: {},
               Contents,
               IsTruncated: true,
               NextContinuationToken: String(++pages),
            }));
         try {
            await expect(
               collectArchiveEntries(f.scope, ["logs/"], limits)
            ).rejects.toMatchObject({ kind: "tooLarge" });
            expect(send).toHaveBeenCalledTimes(
               listingBounds(limits.maxObjects, 1).pages
            );
         } finally {
            f.client.destroy();
         }
      }
   );

   it("derives the page bound from the entry cap, with room for short pages and one per prefix", () => {
      expect(listingBounds(10_000, 1)).toEqual({
         examined: 40_000,
         pages: 2 * 40 + 1,
      });
      expect(listingBounds(100, 3)).toEqual({ examined: 400, pages: 2 + 3 });
   });

   it("counts folder markers and repeated keys toward the examined cap", async () => {
      const f = s3Fixture(async () => listing([]));
      const send = vi.spyOn(f.client, "send").mockImplementation(async () => ({
         $metadata: {},
         Contents: Array.from({ length: 1_000 }, (_, index) => ({
            Key: `logs/dir${index}/`,
            Size: 0,
         })),
         IsTruncated: true,
         NextContinuationToken: "more",
      }));
      try {
         await expect(
            collectArchiveEntries(f.scope, ["logs/"], limits)
         ).rejects.toMatchObject({ kind: "tooLarge" });
         expect(send).toHaveBeenCalledTimes(1);
      } finally {
         f.client.destroy();
      }
   });

   it("refuses a fifth fresh collection at once and frees the place when one ends", async () => {
      const f = s3Fixture(async () => listing([]));
      vi.spyOn(f.client, "send").mockImplementation(
         (_command, options) =>
            new Promise((_resolve, reject) => {
               const { abortSignal } = options as { abortSignal: AbortSignal };
               abortSignal.addEventListener(
                  "abort",
                  () => reject(abortSignal.reason),
                  { once: true }
               );
            })
      );
      const stoppers = Array.from(
         { length: MAX_CONCURRENT_COLLECTIONS },
         () => new AbortController()
      );
      const running = stoppers.map((stopper) =>
         collectArchiveEntries(
            { ...f.scope, signal: stopper.signal },
            ["logs/"],
            limits
         ).catch((error: unknown) => error)
      );
      try {
         await expect(
            collectArchiveEntries(f.scope, ["logs/"], limits)
         ).rejects.toMatchObject({
            kind: "rateLimited",
            message: "Zip preparation is busy. Try again shortly.",
         });
         stoppers[0]!.abort(new Error("done"));
         await running[0];
         await expect(
            collectArchiveEntries(
               { ...f.scope, signal: AbortSignal.abort(new Error("stop")) },
               ["logs/"],
               limits
            )
         ).rejects.toThrow("stop");
         expect(f.client.send).toHaveBeenCalledTimes(
            MAX_CONCURRENT_COLLECTIONS
         );
      } finally {
         stoppers.forEach((stopper) => stopper.abort(new Error("done")));
         await Promise.all(running);
         f.client.destroy();
      }
   });

   it("replays a ticket's manifest without listing or heading anything", async () => {
      const f = s3Fixture(async () => {
         throw new Error("storage must not be asked");
      });
      try {
         const { entries, bytes } = await collectArchiveEntries(
            f.scope,
            ["logs/", "notes.txt"],
            limits,
            undefined,
            [
               ["logs/a.txt", 2],
               ["logs/sub/b.txt", 3],
               ["notes.txt", 4],
            ]
         );
         expect(entries).toEqual([
            { key: "logs/a.txt", name: "logs/a.txt", size: 2 },
            { key: "logs/sub/b.txt", name: "logs/sub/b.txt", size: 3 },
            { key: "notes.txt", name: "notes.txt", size: 4 },
         ]);
         expect(bytes).toBe(9);
         expect(f.requests).toHaveLength(0);
      } finally {
         f.client.destroy();
      }
   });

   it("holds a replayed manifest to the current caps and keeps it out of the collection limit", async () => {
      const f = s3Fixture(async () => listing([]));
      const manifest = [
         ["logs/a.txt", 2],
         ["logs/b.txt", 3],
      ] as const;
      try {
         await expect(
            collectArchiveEntries(
               f.scope,
               ["logs/"],
               { maxObjects: 1, maxBytes: 1_000 },
               undefined,
               manifest
            )
         ).rejects.toMatchObject({ kind: "tooLarge" });
         await expect(
            collectArchiveEntries(
               f.scope,
               ["logs/"],
               { maxObjects: 10, maxBytes: 4 },
               undefined,
               manifest
            )
         ).rejects.toMatchObject({ kind: "tooLarge" });
         const replays = await Promise.all(
            Array.from({ length: MAX_CONCURRENT_COLLECTIONS + 2 }, () =>
               collectArchiveEntries(
                  f.scope,
                  ["logs/"],
                  limits,
                  undefined,
                  manifest
               )
            )
         );
         expect(replays.every(({ entries }) => entries.length === 2)).toBe(
            true
         );
      } finally {
         f.client.destroy();
      }
   });

   it("cancels a slow provider under the collection deadline", async () => {
      vi.useFakeTimers();
      const f = s3Fixture(async () => listing([]));
      let signal: AbortSignal | undefined;
      vi.spyOn(f.client, "send").mockImplementation((_command, options) => {
         signal = (options as { abortSignal: AbortSignal }).abortSignal;
         return new Promise((_resolve, reject) => {
            signal!.addEventListener("abort", () => reject(signal!.reason), {
               once: true,
            });
         });
      });
      try {
         const rejected = expect(
            collectArchiveEntries(f.scope, ["logs/"], limits)
         ).rejects.toBeDefined();
         await vi.advanceTimersByTimeAsync(S3_ROUTE_TIMEOUT_MS);
         await rejected;
         expect(signal?.aborted).toBe(true);
      } finally {
         vi.useRealTimers();
         f.client.destroy();
      }
   });

   it("preserves caller cancellation while adding its own deadline", async () => {
      const f = s3Fixture(async () => listing([]));
      const controller = new AbortController();
      controller.abort(new Error("Disconnected"));
      try {
         await expect(
            collectArchiveEntries(
               { ...f.scope, signal: controller.signal },
               ["logs/"],
               limits
            )
         ).rejects.toThrow("Disconnected");
         expect(f.requests).toHaveLength(0);
      } finally {
         f.client.destroy();
      }
   });
});
