import { listing, reply, s3Fixture } from "@/lib/testing/s3-fixture";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Readable, Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { collectArchiveEntries } from "./entries";
import {
   ARCHIVE_DRAIN_FLOOR_FRACTION,
   ARCHIVE_MIN_BYTES_PER_SECOND,
   ARCHIVE_MS_PER_OBJECT,
   uploadMemoryFor,
} from "@/lib/constants";
import {
   PREFETCH_AHEAD_BYTES,
   PREFETCH_WINDOW,
   archiveDeadlineMs,
   streamArchive,
} from "./stream";

const collect = () => {
   const chunks: Buffer[] = [];
   const output = new Writable({
      write(chunk: Buffer, _encoding, callback) {
         chunks.push(Buffer.from(chunk));
         callback();
      },
   });
   return { output, buffer: () => Buffer.concat(chunks) };
};

const CENTRAL = 0x02014b50;
const EOCD = 0x06054b50;
const ZIP64_FIELD = 0x0001;

const readZip = (zip: Buffer): Record<string, string> => {
   const files: Record<string, string> = {};
   for (let i = 0; i + 46 <= zip.length; i++) {
      if (zip.readUInt32LE(i) !== CENTRAL) continue;
      const nameLength = zip.readUInt16LE(i + 28);
      const extraLength = zip.readUInt16LE(i + 30);
      const name = zip.subarray(i + 46, i + 46 + nameLength).toString("utf8");
      let size = zip.readUInt32LE(i + 20);
      let offset = zip.readUInt32LE(i + 42);
      const extra = zip.subarray(
         i + 46 + nameLength,
         i + 46 + nameLength + extraLength
      );
      for (let e = 0; e + 4 <= extra.length; ) {
         const id = extra.readUInt16LE(e);
         const length = extra.readUInt16LE(e + 2);
         if (id === ZIP64_FIELD) {
            let at = e + 4;
            if (zip.readUInt32LE(i + 24) === 0xffffffff) at += 8;
            if (size === 0xffffffff) {
               size = Number(extra.readBigUInt64LE(at));
               at += 8;
            }
            if (offset === 0xffffffff)
               offset = Number(extra.readBigUInt64LE(at));
         }
         e += 4 + length;
      }
      const start =
         offset +
         30 +
         zip.readUInt16LE(offset + 26) +
         zip.readUInt16LE(offset + 28);
      files[name] = zip.subarray(start, start + size).toString("utf8");
   }
   return files;
};

const hasCentralDirectory = (zip: Buffer): boolean => {
   for (let i = 0; i + 4 <= zip.length; i++) {
      if (zip.readUInt32LE(i) === EOCD) return true;
   }
   return false;
};

const limits = { maxObjects: 100, maxBytes: 1_000_000 };

describe("archive streaming", () => {
   const entries = [
      { key: "logs/a.txt", name: "a.txt", size: 5 },
      { key: "logs/b.txt", name: "b.txt", size: 7 },
   ];
   const bodies: Record<string, string> = {
      "/bucket/logs/a.txt": "alpha",
      "/bucket/logs/b.txt": "bravo!!",
   };

   it("streams every object into a zip that reads back", async () => {
      const f = s3Fixture(async (request) =>
         reply(200, bodies[decodeURIComponent(request.path)] ?? "")
      );
      const sink = collect();
      try {
         await streamArchive({
            maxBytes: limits.maxBytes,
            scope: f.scope,
            entries,
            output: sink.output,
            abortController: new AbortController(),
         });
         const zip = sink.buffer();
         expect(hasCentralDirectory(zip)).toBe(true);
         expect(readZip(zip)).toEqual({ "a.txt": "alpha", "b.txt": "bravo!!" });
         expect(f.requests.map((r) => decodeURIComponent(r.path))).toEqual([
            "/bucket/logs/a.txt",
            "/bucket/logs/b.txt",
         ]);
      } finally {
         f.client.destroy();
      }
   });

   it.each([false, true])(
      "extracts ancestor conflicts, nested collisions and normalized names (reversed=%s)",
      async (reversed) => {
         const keys = [
            "a",
            "a/b.txt",
            "a/b.txt/c",
            "a.2/file",
            "a.3",
            "x/../a",
            "a\\b.txt",
            "a/b.txt.2",
            "a/b.txt.2/nested",
         ];
         if (reversed) keys.reverse();
         const bodies = new Map(
            keys.map((key, index) => [key, `body-${index}`])
         );
         let nextBody = 0;
         const f = s3Fixture(async () =>
            reply(200, bodies.get(keys[nextBody++]!)!)
         );
         const output = collect();
         const directory = await mkdtemp(join(tmpdir(), "s3-viewer-archive-"));
         try {
            const { entries } = await collectArchiveEntries(
               f.scope,
               keys,
               limits,
               new Map(keys.map((key) => [key, bodies.get(key)!.length]))
            );
            await streamArchive({
               maxBytes: limits.maxBytes,
               scope: f.scope,
               entries,
               output: output.output,
               abortController: new AbortController(),
            });
            const extracted = readZip(output.buffer());
            expect(Object.keys(extracted)).toHaveLength(keys.length);
            for (const [name, body] of Object.entries(extracted)) {
               const target = join(directory, name);
               await mkdir(dirname(target), { recursive: true });
               await writeFile(target, body, { flag: "wx" });
            }
            for (const { key, name } of entries)
               expect(await readFile(join(directory, name), "utf8")).toBe(
                  bodies.get(key)
               );
         } finally {
            f.client.destroy();
            await rm(directory, { recursive: true, force: true });
         }
      }
   );

   it("writes no traversing name into the central directory", async () => {
      const f = s3Fixture(async (request) =>
         request.query["list-type"] === "2"
            ? listing([{ key: "docs/..\\..\\..\\..\\tmp\\pwned", size: 5 }])
            : reply(200, "alpha")
      );
      const sink = collect();
      try {
         const collected = await collectArchiveEntries(
            f.scope,
            ["docs/"],
            limits
         );
         await streamArchive({
            maxBytes: limits.maxBytes,
            scope: f.scope,
            entries: collected.entries,
            output: sink.output,
            abortController: new AbortController(),
         });
         const names = Object.keys(readZip(sink.buffer()));
         expect(names).toEqual(["pwned"]);
         expect(names[0]!.split(/[\\/]/)).not.toContain("..");
      } finally {
         f.client.destroy();
      }
   });

   it("keeps every body distinct after archiver canonicalizes names", async () => {
      const keys = [
         "safe.txt",
         "C:/safe.txt",
         "prefix:safe.txt",
         "C:\\safe.txt",
         "safe.txt.2",
         "../C:safe.txt",
         "a/../C:/safe.txt",
         "C:prefix:safe.txt",
         "C:..",
         "file",
      ];
      let nextBody = 0;
      const f = s3Fixture(async () => reply(200, `body-${nextBody++}`));
      const sink = collect();
      try {
         const { entries } = await collectArchiveEntries(
            f.scope,
            keys,
            limits,
            new Map(keys.map((key) => [key, 6]))
         );
         await streamArchive({
            maxBytes: limits.maxBytes,
            scope: f.scope,
            entries,
            output: sink.output,
            abortController: new AbortController(),
         });
         const files = readZip(sink.buffer());
         expect(Object.keys(files)).toEqual(entries.map(({ name }) => name));
         expect(Object.keys(files)).toHaveLength(keys.length);
         expect(new Set(Object.values(files))).toEqual(
            new Set(keys.map((_, index) => `body-${index}`))
         );
         for (const name of Object.keys(files)) {
            expect(name).not.toMatch(/^\w+:|\\|^\//);
            expect(name.split("/")).not.toContain("..");
         }
      } finally {
         f.client.destroy();
      }
   });

   it("leaves no central directory when an object fails mid-stream", async () => {
      const f = s3Fixture(async (request) => {
         if (decodeURIComponent(request.path).endsWith("b.txt")) {
            return reply(
               200,
               new Readable({
                  read() {
                     this.push(Buffer.from("par"));
                     this.destroy(new Error("connection reset"));
                  },
               })
            );
         }
         return reply(200, "alpha");
      });
      const sink = collect();
      try {
         await expect(
            streamArchive({
               maxBytes: limits.maxBytes,
               scope: f.scope,
               entries,
               output: sink.output,
               abortController: new AbortController(),
            })
         ).rejects.toThrow();
         expect(hasCentralDirectory(sink.buffer())).toBe(false);
      } finally {
         f.client.destroy();
      }
   });

   it("gives up on a body that stops producing bytes", async () => {
      const stalled = new Readable({ read() {} });
      stalled.push(Buffer.from("alp"));
      const f = s3Fixture(async (request) =>
         decodeURIComponent(request.path).endsWith("a.txt")
            ? reply(200, stalled)
            : reply(200, "bravo!!")
      );
      const sink = collect();
      const abortController = new AbortController();
      try {
         await expect(
            streamArchive({
               maxBytes: limits.maxBytes,
               scope: f.scope,
               entries,
               output: sink.output,
               abortController,
               idleTimeoutMs: 20,
            })
         ).rejects.toBeDefined();
         expect(abortController.signal.reason).toMatchObject({
            name: "UploadIdleError",
         });
         expect(stalled.destroyed).toBe(true);
         expect(hasCentralDirectory(sink.buffer())).toBe(false);
      } finally {
         f.client.destroy();
      }
   });

   it("gives up on storage that never answers the first object", async () => {
      const headers = Promise.withResolvers<void>();
      const f = s3Fixture(async () => {
         await headers.promise;
         return reply(200, "alpha");
      });
      const sink = collect();
      const abortController = new AbortController();
      try {
         await expect(
            streamArchive({
               maxBytes: limits.maxBytes,
               scope: f.scope,
               entries,
               output: sink.output,
               abortController,
               idleTimeoutMs: 20,
            })
         ).rejects.toMatchObject({ name: "UploadIdleError" });
         expect(sink.buffer()).toHaveLength(0);
      } finally {
         headers.resolve();
         f.client.destroy();
      }
   });

   it.each([
      ["from the first byte", () => true],
      [
         "once the central directory starts",
         (chunk: Buffer) => chunk.includes(Buffer.from("PK\x01\x02", "binary")),
      ],
   ])(
      "gives up on a client that stops reading %s",
      async (_label, stallsOn) => {
         const f = s3Fixture(async () => reply(200, "alpha"));
         let stalled = false;
         const output = new Writable({
            highWaterMark: 1,
            write(chunk: Buffer, _encoding, callback) {
               if (stalled || stallsOn(chunk)) {
                  stalled = true;
                  return;
               }
               callback();
            },
         });
         const abortController = new AbortController();
         try {
            await expect(
               streamArchive({
                  maxBytes: limits.maxBytes,
                  scope: f.scope,
                  entries,
                  output,
                  abortController,
                  idleTimeoutMs: 20,
               })
            ).rejects.toMatchObject({ name: "UploadIdleError" });
            expect(stalled).toBe(true);
         } finally {
            f.client.destroy();
         }
      }
   );

   const KIB = 1024;
   const chunked = (chunks: number) =>
      Readable.from(Array.from({ length: chunks }, () => Buffer.alloc(KIB, 7)));
   const pacedOutput = (everyMs: number) => {
      let drained = 0;
      return {
         drained: () => drained,
         output: new Writable({
            highWaterMark: 1,
            write(chunk: Buffer, _encoding, callback) {
               drained += chunk.length;
               setTimeout(callback, everyMs);
            },
         }),
      };
   };
   const oneEntry = [{ key: "logs/a.txt", name: "a.txt", size: 256 * KIB }];

   it("gives up on a client that keeps reading below the floor rate", async () => {
      const f = s3Fixture(async () => reply(200, chunked(256)));
      const client = pacedOutput(60);
      const abortController = new AbortController();
      try {
         await expect(
            streamArchive({
               maxBytes: limits.maxBytes,
               scope: f.scope,
               entries: oneEntry,
               output: client.output,
               abortController,
               idleTimeoutMs: 200,
            })
         ).rejects.toMatchObject({ name: "UploadIdleError" });
         expect(client.drained()).toBeGreaterThan(0);
         expect(client.drained()).toBeLessThan(256 * KIB);
      } finally {
         f.client.destroy();
      }
   });

   it("leaves a client draining at a healthy rate alone", async () => {
      const f = s3Fixture(async () => reply(200, chunked(64)));
      const client = pacedOutput(2);
      try {
         await streamArchive({
            maxBytes: limits.maxBytes,
            scope: f.scope,
            entries: [{ key: "logs/a.txt", name: "a.txt", size: 64 * KIB }],
            output: client.output,
            abortController: new AbortController(),
            idleTimeoutMs: 1000,
         });
         expect(client.drained()).toBeGreaterThan(64 * KIB);
      } finally {
         f.client.destroy();
      }
   });

   it("measures the drain from the first byte sent, not from the first request", async () => {
      const trickle = async function* () {
         for (let i = 0; i < 64; i++) {
            await new Promise((resolve) => setTimeout(resolve, 20));
            yield Buffer.alloc(KIB, 7);
         }
      };
      const f = s3Fixture(async () => {
         await new Promise((resolve) => setTimeout(resolve, 600));
         return reply(200, Readable.from(trickle()));
      });
      try {
         await streamArchive({
            maxBytes: limits.maxBytes,
            scope: f.scope,
            entries: [{ key: "logs/a.txt", name: "a.txt", size: 64 * KIB }],
            output: collect().output,
            abortController: new AbortController(),
            idleTimeoutMs: 800,
         });
      } finally {
         f.client.destroy();
      }
   });

   it("stops at the first unreadable object", async () => {
      const f = s3Fixture(async (request) =>
         decodeURIComponent(request.path).endsWith("b.txt")
            ? reply(500, "<Error><Code>InternalError</Code></Error>")
            : reply(200, "alpha")
      );
      const sink = collect();
      try {
         await expect(
            streamArchive({
               maxBytes: limits.maxBytes,
               scope: f.scope,
               entries,
               output: sink.output,
               abortController: new AbortController(),
            })
         ).rejects.toBeDefined();
         expect(hasCentralDirectory(sink.buffer())).toBe(false);
      } finally {
         f.client.destroy();
      }
   });
});

describe("archive input byte limits", () => {
   it.each([undefined, "1", "100"])(
      "rejects changed bytes with Content-Length %s",
      async (length) => {
         const body = Readable.from([Buffer.alloc(100, 65)]);
         const f = s3Fixture(async () =>
            reply(
               200,
               body,
               length === undefined ? {} : { "content-length": length }
            )
         );
         const sink = collect();
         const abortController = new AbortController();
         try {
            await expect(
               streamArchive({
                  scope: f.scope,
                  entries: [{ key: "a", name: "a", size: 1 }],
                  output: sink.output,
                  abortController,
                  maxBytes: 10,
               })
            ).rejects.toMatchObject({ status: 413 });
            expect(body.destroyed).toBe(true);
            expect(hasCentralDirectory(sink.buffer())).toBe(false);
            expect(sink.buffer().includes(Buffer.alloc(100, 65))).toBe(false);
         } finally {
            f.client.destroy();
         }
      }
   );

   it("limits actual bytes across entries before forwarding the crossing chunk", async () => {
      const bodies = [Readable.from(["abcdef"]), Readable.from(["ghijkl"])];
      let next = 0;
      const f = s3Fixture(async () => reply(200, bodies[next++]));
      const sink = collect();
      try {
         await expect(
            streamArchive({
               scope: f.scope,
               entries: [
                  { key: "a", name: "a", size: 1 },
                  { key: "b", name: "b", size: 1 },
               ],
               output: sink.output,
               abortController: new AbortController(),
               maxBytes: 10,
            })
         ).rejects.toMatchObject({ status: 413 });
         expect(bodies.every((body) => body.destroyed)).toBe(true);
         expect(hasCentralDirectory(sink.buffer())).toBe(false);
         expect(sink.buffer().includes(Buffer.from("ghijkl"))).toBe(false);
      } finally {
         f.client.destroy();
      }
   });

   it("checks folder GETs against the cap after a stale listing", async () => {
      const f = s3Fixture(async (request) =>
         request.query["list-type"]
            ? listing([{ key: "folder/a", size: 1 }])
            : reply(200, "larger-than-cap")
      );
      const sink = collect();
      try {
         const { entries } = await collectArchiveEntries(f.scope, ["folder/"], {
            maxObjects: 10,
            maxBytes: 5,
         });
         await expect(
            streamArchive({
               scope: f.scope,
               entries,
               output: sink.output,
               abortController: new AbortController(),
               maxBytes: 5,
            })
         ).rejects.toMatchObject({ status: 413 });
         expect(hasCentralDirectory(sink.buffer())).toBe(false);
      } finally {
         f.client.destroy();
      }
   });

   it("returns the actual byte count instead of the estimate", async () => {
      const f = s3Fixture(async () =>
         reply(200, Readable.from(["abc", "def"]))
      );
      const sink = collect();
      try {
         expect(
            await streamArchive({
               scope: f.scope,
               entries: [{ key: "a", name: "a", size: 1 }],
               output: sink.output,
               abortController: new AbortController(),
               maxBytes: 6,
            })
         ).toBe(6);
         expect(readZip(sink.buffer())).toEqual({ a: "abcdef" });
      } finally {
         f.client.destroy();
      }
   });
});

describe("bounded archive prefetch", () => {
   const entries = Array.from({ length: 20 }, (_, index) => ({
      key: `${index}.txt`,
      name: `${index}.txt`,
      size: 1,
   }));
   const nextTurn = () => new Promise<void>((resolve) => setImmediate(resolve));

   it("keeps a slow downloader's speculative bodies paused even when listed sizes are stale", async () => {
      const bodies: Readable[] = [];
      const opened = Promise.withResolvers<void>();
      const f = s3Fixture(async () => {
         const body = new Readable({
            highWaterMark: 8192,
            read() {
               this.push(Buffer.alloc(8192));
            },
         });
         bodies.push(body);
         if (bodies.length === PREFETCH_WINDOW) opened.resolve();
         return reply(200, body);
      });
      const output = new Writable({ highWaterMark: 1, write() {} });
      const controller = new AbortController();
      const pending = streamArchive({
         scope: f.scope,
         entries,
         output,
         abortController: controller,
         maxBytes: 64 * 1024 * 1024,
      });
      const rejected = expect(pending).rejects.toThrow("cancel download");
      try {
         await opened.promise;
         await nextTurn();
         expect(f.requests).toHaveLength(PREFETCH_WINDOW);
         expect(
            bodies.slice(1).every((body) => body.readableFlowing === false)
         ).toBe(true);
         expect(
            bodies.slice(1).every((body) => body.readableLength === 0)
         ).toBe(true);
         expect(bodies[0]!.readableLength).toBeLessThanOrEqual(8192);
         controller.abort(new Error("cancel download"));
         await rejected;
         expect(bodies.every((body) => body.destroyed)).toBe(true);
      } finally {
         controller.abort();
         output.destroy();
         f.client.destroy();
      }
   });

   it("does not prefetch past an entry larger than the lookahead", async () => {
      const started = Promise.withResolvers<void>();
      const body = new Readable({ read() {} });
      const f = s3Fixture(async () => {
         started.resolve();
         return reply(200, body);
      });
      const controller = new AbortController();
      const pending = streamArchive({
         scope: f.scope,
         entries: [
            { ...entries[0]!, size: PREFETCH_AHEAD_BYTES + 1 },
            ...entries.slice(1),
         ],
         output: collect().output,
         abortController: controller,
         maxBytes: 2 * PREFETCH_AHEAD_BYTES,
      });
      const rejected = expect(pending).rejects.toThrow("cancel download");
      try {
         await started.promise;
         await nextTurn();
         expect(f.requests).toHaveLength(1);
         controller.abort(new Error("cancel download"));
         await rejected;
         expect(body.destroyed).toBe(true);
      } finally {
         controller.abort();
         f.client.destroy();
      }
   });

   it("destroys late response bodies after cancellation without waiting for their headers", async () => {
      const headers = Promise.withResolvers<void>();
      const started = Promise.withResolvers<void>();
      const bodies: Readable[] = [];
      const f = s3Fixture(async () => {
         const body = new Readable({ read() {} });
         bodies.push(body);
         if (bodies.length === PREFETCH_WINDOW) started.resolve();
         await headers.promise;
         return reply(200, body);
      });
      const controller = new AbortController();
      const pending = streamArchive({
         scope: f.scope,
         entries,
         output: collect().output,
         abortController: controller,
         maxBytes: limits.maxBytes,
      });
      const rejected = expect(pending).rejects.toThrow("cancel before headers");
      try {
         await started.promise;
         controller.abort(new Error("cancel before headers"));
         await rejected;
         headers.resolve();
         await nextTurn();
         expect(bodies.every((body) => body.destroyed)).toBe(true);
         expect(f.requests).toHaveLength(PREFETCH_WINDOW);
      } finally {
         headers.resolve();
         controller.abort();
         f.client.destroy();
      }
   });

   it("cancels the active and queued bodies when a prefetched source fails", async () => {
      const opened = Promise.withResolvers<void>();
      const bodies: Readable[] = [];
      const f = s3Fixture(async () => {
         const body = new Readable({ read() {} });
         bodies.push(body);
         if (bodies.length === PREFETCH_WINDOW) opened.resolve();
         return reply(200, body);
      });
      const controller = new AbortController();
      const pending = streamArchive({
         scope: f.scope,
         entries,
         output: collect().output,
         abortController: controller,
         maxBytes: limits.maxBytes,
      });
      const rejected = expect(pending).rejects.toThrow("prefetch failed");
      try {
         await opened.promise;
         await nextTurn();
         bodies[2]!.destroy(new Error("prefetch failed"));
         await rejected;
         expect(bodies.every((body) => body.destroyed)).toBe(true);
         expect(f.requests).toHaveLength(PREFETCH_WINDOW);
      } finally {
         controller.abort();
         f.client.destroy();
      }
   });

   it.each([
      ["one-MiB", 1024 * 1024, PREFETCH_WINDOW],
      ["four-MiB", 4 * 1024 * 1024, 3],
      ["eight-MiB", 8 * 1024 * 1024, 2],
   ])(
      "keeps the next %s entries open while the current one streams",
      async (_name, size, expected) => {
         const started = Promise.withResolvers<void>();
         const bodies: Readable[] = [];
         const f = s3Fixture(async () => {
            const body = new Readable({ read() {} });
            bodies.push(body);
            if (bodies.length === expected) started.resolve();
            return reply(200, body);
         });
         const controller = new AbortController();
         const pending = streamArchive({
            scope: f.scope,
            entries: entries.map((entry) => ({ ...entry, size })),
            output: collect().output,
            abortController: controller,
            maxBytes: entries.length * size,
         });
         const rejected = expect(pending).rejects.toThrow("cancel download");
         try {
            await started.promise;
            await nextTurn();
            expect(f.requests).toHaveLength(expected);
            expect(
               bodies.slice(1).every((body) => body.readableFlowing === false)
            ).toBe(true);
            controller.abort(new Error("cancel download"));
            await rejected;
            expect(bodies.every((body) => body.destroyed)).toBe(true);
         } finally {
            controller.abort();
            f.client.destroy();
         }
      }
   );

   it("sizes the window so paused bodies fit the zip slot's reservation", () => {
      const pausedBodyBytes = 128 * 1024;
      expect(PREFETCH_WINDOW * pausedBodyBytes).toBeLessThan(
         uploadMemoryFor(5 * 1024 * 1024) / 4
      );
   });
});

describe("zip deadline", () => {
   it("lets a client holding exactly the drain floor finish", () => {
      const floorBytesPerSecond =
         ARCHIVE_MIN_BYTES_PER_SECOND * ARCHIVE_DRAIN_FLOOR_FRACTION;
      const bytes = 200 * 1024 * 1024;
      const objects = 40;
      // the drain floor credits work-ms per window; the deadline is the wall time that credit needs at the floor.
      const credited =
         (bytes / ARCHIVE_MIN_BYTES_PER_SECOND) * 1000 +
         objects * ARCHIVE_MS_PER_OBJECT;
      expect(archiveDeadlineMs(bytes, objects)).toBeCloseTo(
         credited / ARCHIVE_DRAIN_FLOOR_FRACTION
      );
      expect(archiveDeadlineMs(bytes, 0)).toBeGreaterThanOrEqual(
         (bytes / floorBytesPerSecond) * 1000
      );
   });

   it("allows a 100 MiB zip over a 1 Mbit/s link, which the old one-MiB-per-second basis cut off", () => {
      const slowLinkBytesPerSecond = 125_000;
      const bytes = 100 * 1024 * 1024;
      expect(archiveDeadlineMs(bytes, 1)).toBeGreaterThan(
         (bytes / slowLinkBytesPerSecond) * 1000
      );
   });
});
