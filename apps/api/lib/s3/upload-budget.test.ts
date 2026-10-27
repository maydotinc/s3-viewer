import { describe, expect, it } from "vitest";
import { MINUTE_MS } from "@s3-viewer/shared";
import {
   ARCHIVE_POOL,
   createUploadBudget,
   slotLifetimeMs,
   UPLOAD_SLOT_MAX_MS,
} from "./upload-budget";

describe("upload admission", () => {
   it("caps each user's active uploads without blocking other users", () => {
      const budget = createUploadBudget({
         maxUploads: 3,
         maxPerUser: 1,
         maxBytes: 100,
      });
      const release = budget.acquire("a", 20);
      expect(() => budget.acquire("a", 20)).toThrow(/busy/);
      expect(() => budget.acquire("b", 20)).not.toThrow();
      release();
      release();
      expect(() => budget.acquire("a", 20)).not.toThrow();
      expect(() => budget.acquire("a", 20)).toThrow(/busy/);
   });

   it("limits each account to one slot once half the pool is busy", () => {
      const budget = createUploadBudget({
         maxUploads: 6,
         maxPerUser: 3,
         maxBytes: 1000,
      });
      for (let i = 0; i < 3; i++) budget.acquire("a", 10);
      expect(() => budget.acquire("b", 10)).not.toThrow();
      expect(() => budget.acquire("b", 10)).toThrow(/busy/);
      expect(() => budget.acquire("c", 10)).not.toThrow();
      expect(() => budget.acquire("d", 10)).not.toThrow();
      expect(() => budget.acquire("e", 10)).toThrow(/busy/);
   });

   it("lets one account use its full share while the pool is quiet", () => {
      const budget = createUploadBudget({
         maxUploads: 6,
         maxPerUser: 3,
         maxBytes: 1000,
      });
      const first = budget.acquire("a", 10);
      budget.acquire("a", 10);
      budget.acquire("a", 10);
      expect(() => budget.acquire("a", 10)).toThrow(/busy/);
      first();
      expect(() => budget.acquire("b", 10)).not.toThrow();
      expect(() => budget.acquire("a", 10)).toThrow(/busy/);
   });

   it("counts a zip's slots apart from an upload's", () => {
      const budget = createUploadBudget({
         maxUploads: 2,
         maxPerUser: 1,
         maxBytes: 1000,
      });
      const zip = budget.acquire("a", 10, ARCHIVE_POOL);
      budget.acquire("b", 10, ARCHIVE_POOL);
      expect(() => budget.acquire("c", 10, ARCHIVE_POOL)).toThrow(
         /Zip capacity is busy/
      );
      expect(() => budget.acquire("a", 10)).not.toThrow();
      expect(() => budget.acquire("b", 10)).not.toThrow();
      expect(() => budget.acquire("c", 10)).toThrow(/Upload capacity is busy/);
      zip();
      expect(() => budget.acquire("c", 10, ARCHIVE_POOL)).not.toThrow();
   });

   it("draws every pool on the one memory budget", () => {
      const budget = createUploadBudget({
         maxUploads: 6,
         maxPerUser: 3,
         maxBytes: 100,
      });
      const zip = budget.acquire("a", 80, ARCHIVE_POOL);
      expect(() => budget.acquire("b", 21)).toThrow(/busy/);
      zip();
      expect(() => budget.acquire("b", 21)).not.toThrow();
   });

   it("caps what zips may hold at their share while an empty pool still admits one", () => {
      const budget = createUploadBudget({
         maxUploads: 6,
         maxPerUser: 3,
         maxBytes: 100,
      });
      const first = budget.acquire("a", 40, ARCHIVE_POOL);
      expect(() => budget.acquire("b", 40, ARCHIVE_POOL)).toThrow(
         /Zip capacity/
      );
      expect(() => budget.acquire("b", 40)).not.toThrow();
      first();
      expect(() => budget.acquire("c", 55, ARCHIVE_POOL)).not.toThrow();
   });

   it("reserves shared memory, rejects impossible uploads, and reclaims it", () => {
      const budget = createUploadBudget({
         maxUploads: 10,
         maxPerUser: 3,
         maxBytes: 100,
      });
      expect(() => budget.acquire("a", 100)).toThrow(/buffer memory/);
      const release = budget.acquire("a", 80);
      expect(() => budget.acquire("b", 21)).toThrow(/busy/);
      release();
      expect(() => budget.acquire("b", 99)).not.toThrow();
   });

   it("lets accounts behind one address hold no more than one account could", () => {
      const budget = createUploadBudget({
         maxUploads: 6,
         maxPerUser: 3,
         maxBytes: 1000,
         maxPerIp: 2,
      });
      const first = budget.acquire("a", 10, undefined, "198.51.100.1");
      budget.acquire("b", 10, undefined, "198.51.100.1");
      budget.acquire("c", 10, undefined, "198.51.100.1");
      expect(() => budget.acquire("d", 10, undefined, "198.51.100.1")).toThrow(
         /busy/
      );
      expect(() =>
         budget.acquire("d", 10, undefined, "198.51.100.2")
      ).not.toThrow();
      first();
      expect(() => budget.acquire("e", 10, undefined, "198.51.100.1")).toThrow(
         /busy/
      );
   });

   it("drops an address to its crowded share once half the pool is busy", () => {
      const budget = createUploadBudget({
         maxUploads: 6,
         maxPerUser: 3,
         maxBytes: 1000,
         maxPerIp: 2,
      });
      for (const user of ["a", "b", "c"])
         budget.acquire(user, 10, undefined, `203.0.113.${user.charCodeAt(0)}`);
      budget.acquire("d", 10, undefined, "198.51.100.1");
      budget.acquire("e", 10, undefined, "198.51.100.1");
      expect(() => budget.acquire("f", 10, undefined, "198.51.100.1")).toThrow(
         /busy/
      );
   });

   it("keeps one server from holding more than half the pool once it is crowded", () => {
      const budget = createUploadBudget({
         maxUploads: 6,
         maxPerUser: 3,
         maxBytes: 1000,
         maxPerIp: 6,
      });
      const slot = (user: string, server: string) =>
         budget.acquire(user, 10, undefined, undefined, server);
      slot("a", "s1");
      slot("b", "s1");
      slot("c", "s1");
      expect(() => slot("d", "s1")).toThrow(/busy/);
      expect(() => slot("e", "s2")).not.toThrow();
      expect(() => slot("f", "s2")).not.toThrow();
   });

   it("lets a quiet pool serve one server and one address without the crowded caps", () => {
      const budget = createUploadBudget({
         maxUploads: 6,
         maxPerUser: 3,
         maxBytes: 1000,
         maxPerIp: 1,
      });
      const slot = (user: string) =>
         budget.acquire(user, 10, undefined, "198.51.100.1", "s1");
      slot("a");
      slot("b");
      expect(() => slot("c")).not.toThrow();
      expect(() => slot("d")).toThrow(/busy/);
   });

   it("frees a server's slot on release", () => {
      const budget = createUploadBudget({
         maxUploads: 2,
         maxPerUser: 2,
         maxBytes: 1000,
      });
      const first = budget.acquire("a", 10, undefined, undefined, "s1");
      expect(() => budget.acquire("b", 10, undefined, undefined, "s1")).toThrow(
         /busy/
      );
      first();
      expect(() =>
         budget.acquire("b", 10, undefined, undefined, "s1")
      ).not.toThrow();
   });

   it("counts an address's zip slots apart from its uploads and ignores a missing address", () => {
      const budget = createUploadBudget({
         maxUploads: 6,
         maxPerUser: 1,
         maxBytes: 1000,
         maxPerIp: 1,
      });
      budget.acquire("a", 10, undefined, "198.51.100.1");
      expect(() =>
         budget.acquire("b", 10, ARCHIVE_POOL, "198.51.100.1")
      ).not.toThrow();
      expect(() => budget.acquire("c", 10, undefined, "")).not.toThrow();
      expect(() => budget.acquire("d", 10)).not.toThrow();
   });
});

describe("slot lifetime", () => {
   it("scales with the declared size between a floor and a cap", () => {
      expect(slotLifetimeMs(0)).toBe(10 * MINUTE_MS);
      expect(slotLifetimeMs(64 * 1024 * 1024)).toBe(10 * MINUTE_MS);
      expect(slotLifetimeMs(1024 * 1024 * 1024)).toBe(4096 * 1000);
      expect(slotLifetimeMs(5 * 1024 * 1024 * 1024)).toBe(UPLOAD_SLOT_MAX_MS);
   });

   it("gives an undeclared size the full cap", () => {
      expect(slotLifetimeMs(undefined)).toBe(UPLOAD_SLOT_MAX_MS);
   });
});
