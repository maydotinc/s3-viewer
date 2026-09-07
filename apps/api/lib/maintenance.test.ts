import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
   executeRaw: vi.fn(),
   sweepRateLimits: vi.fn(),
   warn: vi.fn(),
   info: vi.fn(),
   retentionDays: 30,
}));

vi.mock("@/lib/env", () => ({
   env: {
      get AUDIT_RETENTION_DAYS() {
         return h.retentionDays;
      },
   },
}));
vi.mock("@/lib/logger", () => ({
   logger: { info: h.info, warn: h.warn },
   describeError: (error: unknown) => String(error),
}));
vi.mock("@s3-viewer/db", () => ({ prisma: { $executeRaw: h.executeRaw } }));
vi.mock("@s3-viewer/db/rate-limit", () => ({
   sweepRateLimits: h.sweepRateLimits,
}));

const { startMaintenance } = await import("./maintenance");

// startMaintenance kicks off its boot sweep without awaiting it.
const sweepOnce = async () => {
   vi.useFakeTimers();
   startMaintenance();
   // enough for the pauses between batches, far short of the hourly interval
   await vi.advanceTimersByTimeAsync(1000);
   vi.useRealTimers();
};

const sql = (call: unknown[]) => (call[0] as string[]).join("?");

beforeEach(() => {
   vi.clearAllMocks();
   h.retentionDays = 30;
   h.sweepRateLimits.mockResolvedValue(0);
   h.executeRaw.mockResolvedValue(0);
});

describe("audit log prune", () => {
   it("deletes in bounded batches until a short page ends the backlog", async () => {
      h.executeRaw
         .mockResolvedValueOnce(5000)
         .mockResolvedValueOnce(5000)
         .mockResolvedValueOnce(120);
      await sweepOnce();

      expect(h.executeRaw).toHaveBeenCalledTimes(3);
      const statement = sql(h.executeRaw.mock.calls[0] ?? []);
      expect(statement).toContain('DELETE FROM "audit_log"');
      expect(statement).toContain("LIMIT");
      // the cutoff and the batch size travel as bound parameters, never inlined
      const [, cutoff, limit] = h.executeRaw.mock.calls[0] ?? [];
      expect(cutoff).toBeInstanceOf(Date);
      expect(limit).toBe(5000);
      expect(h.info).toHaveBeenCalledWith("Maintenance sweep", {
         auditRows: 10_120,
         rateLimitRows: 0,
      });
   });

   it("stops after one statement when the first batch is short", async () => {
      h.executeRaw.mockResolvedValueOnce(3);
      await sweepOnce();
      expect(h.executeRaw).toHaveBeenCalledOnce();
   });

   it("keeps every row when retention is off but still sweeps rate limits", async () => {
      h.retentionDays = 0;
      h.sweepRateLimits.mockResolvedValue(7);
      await sweepOnce();

      expect(h.executeRaw).not.toHaveBeenCalled();
      expect(h.info).toHaveBeenCalledWith("Maintenance sweep", {
         auditRows: 0,
         rateLimitRows: 7,
      });
   });

   it("logs a failing sweep instead of throwing", async () => {
      h.executeRaw.mockRejectedValue(new Error("database is starting up"));
      await expect(sweepOnce()).resolves.toBeUndefined();

      expect(h.warn).toHaveBeenCalledWith("Maintenance sweep failed", {
         error: expect.stringContaining("database is starting up"),
      });
      expect(h.info).not.toHaveBeenCalled();
   });
});
