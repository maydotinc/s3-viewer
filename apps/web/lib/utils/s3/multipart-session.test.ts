import { DAY_MS, MAX_MULTIPART_PARTS } from "@s3-viewer/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryStorage } from "@/lib/test/storage";
import { createWebLocks } from "@/lib/test/web-locks";
import type { MultipartSession } from "./multipart-session";

const identity = vi.hoisted(() => ({
   userId: "user-a" as string | null,
   listener: null as
      | null
      | ((
           state: { userId: string | null },
           previous: { userId: string | null }
        ) => void),
}));
vi.mock("@/lib/stores/session-store", () => ({
   default: {
      getState: () => identity,
      subscribe: (listener: typeof identity.listener) => {
         identity.listener = listener;
      },
   },
}));

const local = createMemoryStorage();
const { memory } = local;
const storage = {
   getItem: vi.fn(local.getItem),
   setItem: vi.fn(local.setItem),
   removeItem: vi.fn(local.removeItem),
};
const target = { serverId: "s", bucketName: "b", objectKey: "k" };
const file = new File(["x".repeat(MAX_MULTIPART_PARTS)], "large.bin", {
   lastModified: 1000,
});
const session = (
   overrides: Partial<MultipartSession> = {}
): MultipartSession => ({
   userId: "user-a",
   ...target,
   uploadId: "upload-1",
   partSize: 1,
   partCount: file.size,
   fileName: file.name,
   fileSize: file.size,
   lastModified: file.lastModified,
   expectedETag: null,
   savedAt: Date.now(),
   partDigests: {},
   ...overrides,
});
const proof = { eTag: '"p1"', sha256: "a".repeat(64) };
const candidate = { userId: "user-a", target, file, expectedETag: null };
const catalogKey = "s3-viewer.multipart-uploads";
const load = () => import("./multipart-session");

beforeEach(() => {
   vi.restoreAllMocks();
   vi.resetModules();
   memory.clear();
   identity.userId = "user-a";
   identity.listener = null;
   storage.getItem
      .mockReset()
      .mockImplementation((key) => memory.get(key) ?? null);
   storage.setItem.mockReset().mockImplementation((key, value) => {
      memory.set(key, value);
   });
   storage.removeItem.mockReset().mockImplementation((key) => {
      memory.delete(key);
   });
   vi.stubGlobal("localStorage", storage);
   vi.stubGlobal("navigator", { locks: createWebLocks() });
});

describe("incremental multipart resume persistence", () => {
   it("bounds every part write and reloads all 10,000 proofs from storage", async () => {
      const saved = session();
      const { rememberSession, rememberPartDigest } = await load();
      expect(await rememberSession(saved)).toBe(true);
      storage.setItem.mockClear();
      for (let part = 1; part <= MAX_MULTIPART_PARTS; part++)
         await rememberPartDigest(saved, part, {
            ...proof,
            eTag: `"p${part}"`,
         });
      const writes = storage.setItem.mock.calls;
      expect(writes).toHaveLength(MAX_MULTIPART_PARTS);
      expect(writes.every(([key]) => key !== catalogKey)).toBe(true);
      expect(Math.max(...writes.map(([, value]) => value.length))).toBeLessThan(
         8_000
      );
      expect(
         writes.reduce((total, [, value]) => total + value.length, 0)
      ).toBeLessThan(40_000_000);
      expect(memory.size).toBeLessThan(160);

      vi.resetModules();
      const { resumableSession } = await load();
      storage.getItem.mockClear();
      expect(
         (await resumableSession(candidate)).resumable?.partDigests
      ).toEqual(saved.partDigests);
      expect(storage.getItem.mock.calls.length).toBeLessThan(160);
   });

   it("invalidates a proof durably before a reload", async () => {
      const { rememberSession, forgetPartDigest } = await load();
      const saved = session({ partDigests: { 1: proof, 2: proof } });
      await rememberSession(saved);
      expect(await forgetPartDigest(saved, 1)).toBe(true);
      vi.resetModules();
      expect(
         (await (await load()).resumableSession(candidate)).resumable
            ?.partDigests
      ).toEqual({
         2: proof,
      });
   });

   it("reports a refused invalidation and retains its in-memory proof", async () => {
      const { rememberSession, forgetPartDigest } = await load();
      const saved = session({ partDigests: { 1: proof, 2: proof } });
      await rememberSession(saved);
      vi.spyOn(storage, "setItem").mockImplementation(() => {
         throw new Error("Quota refused");
      });
      expect(await forgetPartDigest(saved, 1)).toBe(false);
      expect(saved.partDigests?.[1]).toEqual(proof);
   });

   it("makes a lost success write cost resumability without throwing", async () => {
      const { rememberSession, rememberPartDigest, resumableSession } =
         await load();
      const saved = session();
      await rememberSession(saved);
      vi.spyOn(storage, "setItem").mockImplementation(() => {
         throw new Error("Quota refused");
      });
      await expect(
         rememberPartDigest(saved, 1, proof)
      ).resolves.toBeUndefined();
      expect(
         (await resumableSession(candidate)).resumable?.partDigests
      ).toEqual({});
   });

   it("cleans chunks on completion, replacement, expiration, and eviction", async () => {
      const { rememberSession, forgetSession } = await load();
      await rememberSession(session({ partDigests: { 1: proof } }));
      await forgetSession(target, "upload-1");
      expect(memory.size).toBe(1);
      await rememberSession(session({ partDigests: { 1: proof } }));
      await rememberSession(session({ uploadId: "upload-2" }));
      expect(memory.size).toBe(1);
      await rememberSession(
         session({
            partDigests: { 1: proof },
            savedAt: Date.now() - 8 * DAY_MS,
         })
      );
      expect(memory.size).toBe(1);
      for (let i = 0; i < 51; i++) {
         await rememberSession(
            session({
               objectKey: `object-${i}`,
               uploadId: `upload-${i}`,
               savedAt: Date.now() + i,
               partDigests: { 1: proof },
            })
         );
      }
      expect(Object.keys(JSON.parse(memory.get(catalogKey)!))).toHaveLength(50);
      expect(memory.size).toBe(51);
   });

   it("refreshes an active session without rewriting its completed chunks", async () => {
      const { rememberSession, rememberPartDigest, resumableSession } =
         await load();
      const saved = session({ savedAt: Date.now() - 2 * DAY_MS });
      await rememberSession(saved);
      storage.setItem.mockClear();
      await rememberPartDigest(saved, 1, proof);
      expect(
         (await resumableSession(candidate)).resumable?.savedAt
      ).toBeGreaterThan(saved.savedAt);
      expect(storage.setItem.mock.calls).toHaveLength(2);
      await rememberPartDigest(saved, 2, proof);
      expect(storage.setItem.mock.calls).toHaveLength(3);
   });

   it("cleans staged chunks when metadata cannot be saved", async () => {
      const { rememberSession } = await load();
      vi.spyOn(storage, "setItem").mockImplementation((key, value) => {
         if (key === catalogKey) throw new Error("Quota refused");
         memory.set(key, value);
      });
      expect(
         await rememberSession(session({ partDigests: { 1: proof } }))
      ).toBe(false);
      expect(memory.size).toBe(0);
   });
});

describe("multipart persistence across tabs", () => {
   const otherTab = async () => {
      vi.resetModules();
      return load();
   };

   it("queues invalidation behind a stale chunk read instead of resurrecting its proof", async () => {
      const first = await load();
      const saved = session({ partDigests: { 1: proof } });
      await first.rememberSession(saved);
      const second = await otherTab();
      let invalidation: Promise<boolean> | undefined;
      const originalGet = storage.getItem.getMockImplementation()!;
      storage.getItem.mockImplementation((key) => {
         const raw = originalGet(key);
         if (key.includes(".parts.") && !invalidation)
            invalidation = first.forgetPartDigest(saved, 1);
         return raw;
      });
      await second.rememberPartDigest(session(), 2, proof);
      await expect(invalidation).resolves.toBe(true);
      expect(
         (await first.resumableSession(candidate)).resumable?.partDigests
      ).toEqual({
         2: proof,
      });
   });

   it("does not restore an entry removed while a different tab refreshes the catalog", async () => {
      const first = await load();
      const saved = session({ savedAt: Date.now() - 2 * DAY_MS });
      await first.rememberSession(saved);
      const second = await otherTab();
      let removal: Promise<void> | undefined;
      const originalGet = storage.getItem.getMockImplementation()!;
      storage.getItem.mockImplementation((key) => {
         const raw = originalGet(key);
         if (key === catalogKey && !removal)
            removal = first.forgetSession(target, saved.uploadId);
         return raw;
      });
      await second.rememberPartDigest(saved, 1, proof);
      await removal;
      expect((await first.resumableSession(candidate)).resumable).toBeNull();
      expect(memory.size).toBe(1);
   });

   it("keeps a second target inserted while a different tab refreshes the catalog", async () => {
      const first = await load();
      const saved = session({ savedAt: Date.now() - 2 * DAY_MS });
      await first.rememberSession(saved);
      const second = await otherTab();
      let insertion: Promise<boolean> | undefined;
      const originalGet = storage.getItem.getMockImplementation()!;
      storage.getItem.mockImplementation((key) => {
         const raw = originalGet(key);
         if (key === catalogKey && !insertion)
            insertion = first.rememberSession(
               session({ objectKey: "second", uploadId: "upload-2" })
            );
         return raw;
      });
      await second.rememberPartDigest(saved, 1, proof);
      await expect(insertion).resolves.toBe(true);
      expect(
         (await first.resumableSession(candidate)).resumable?.partDigests
      ).toEqual({
         1: proof,
      });
      expect(
         (
            await first.resumableSession({
               ...candidate,
               target: { ...target, objectKey: "second" },
            })
         ).resumable?.uploadId
      ).toBe("upload-2");
   });

   it("serializes account cleanup and rejects old-account successes queued behind it", async () => {
      const { rememberSession, rememberPartDigest, resumableSession } =
         await load();
      const saved = session({ partDigests: { 1: proof } });
      await rememberSession(saved);
      expect(
         await resumableSession({ ...candidate, userId: "user-b" })
      ).toEqual({ resumable: null, stale: null });
      let release!: () => void;
      let entered!: () => void;
      const acquired = new Promise<void>((resolve) => {
         entered = resolve;
      });
      const held = navigator.locks.request(
         "s3-viewer.multipart-storage",
         () => {
            entered();
            return new Promise<void>((resolve) => {
               release = resolve;
            });
         }
      );
      await acquired;
      identity.userId = "user-b";
      identity.listener?.({ userId: "user-b" }, { userId: "user-a" });
      const lateProof = rememberPartDigest(saved, 2, proof);
      const lateSession = rememberSession(saved);
      const next = rememberSession(
         session({ userId: "user-b", uploadId: "upload-b" })
      );
      release();
      await held;
      await lateProof;
      expect(await lateSession).toBe(false);
      expect(await next).toBe(true);
      expect(Object.values(JSON.parse(memory.get(catalogKey)!))).toEqual([
         expect.objectContaining({ userId: "user-b", uploadId: "upload-b" }),
      ]);
      expect(memory.size).toBe(1);
   });

   it("does not touch persisted data without a storage lock", async () => {
      const {
         rememberSession,
         rememberPartDigest,
         resumableSession,
         forgetSession,
      } = await load();
      const saved = session({ partDigests: { 1: proof } });
      await rememberSession(saved);
      storage.getItem.mockClear();
      storage.setItem.mockClear();
      storage.removeItem.mockClear();
      vi.stubGlobal("navigator", {});
      expect(await rememberSession(saved)).toBe(false);
      await rememberPartDigest(saved, 2, proof);
      expect(await resumableSession(candidate)).toEqual({
         resumable: null,
         stale: null,
      });
      await forgetSession(target);
      expect(storage.getItem).not.toHaveBeenCalled();
      expect(storage.setItem).not.toHaveBeenCalled();
      expect(storage.removeItem).not.toHaveBeenCalled();
   });
});

describe("explicit sign-out", () => {
   it("forgets only the departing account's catalog entries and chunks", async () => {
      const { rememberSession, forgetAccountSessions } = await load();
      await rememberSession(session({ partDigests: { 1: proof } }));
      identity.userId = "user-b";
      await rememberSession(
         session({
            userId: "user-b",
            objectKey: "other",
            uploadId: "upload-b",
            partDigests: { 1: proof },
         })
      );
      expect(memory.size).toBe(3);

      await forgetAccountSessions("user-a");

      expect(Object.values(JSON.parse(memory.get(catalogKey)!))).toEqual([
         expect.objectContaining({ userId: "user-b", uploadId: "upload-b" }),
      ]);
      expect(memory.size).toBe(2);
   });
});
