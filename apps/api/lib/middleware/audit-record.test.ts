import type { Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
   writeAudits: vi.fn(),
   appendAuditWithin: vi.fn(),
   error: vi.fn(),
}));

vi.mock("@/lib/audit/writer", () => ({
   writeAudits: h.writeAudits,
   appendAuditWithin: h.appendAuditWithin,
}));
vi.mock("@/lib/logger", () => ({ logger: { error: h.error } }));

const { auditUnavailable, record, recordManyFor, recordWithin } = await import(
   "./audit-record"
);

const res = (enabled = false) =>
   ({
      locals: {
         auth: { userId: "actor12345", audit: { enabled, level: "ALL" } },
         input: { serverId: "server12345" },
      },
      req: { user: { id: "actor12345", email: "actor@example.com" } },
   }) as unknown as Response;

beforeEach(() => {
   vi.clearAllMocks();
   h.writeAudits.mockResolvedValue(undefined);
   h.appendAuditWithin.mockResolvedValue(undefined);
});

describe("after the action", () => {
   it("reports a mutation as done when its audit write fails, and logs the loss", async () => {
      h.writeAudits.mockRejectedValue(new Error("connection reset"));
      await expect(
         record(res(true), { action: "member.remove" })
      ).resolves.toBeUndefined();
      expect(h.error).toHaveBeenCalledWith("audit write failed after action", {
         serverId: "server12345",
         actions: ["member.remove"],
         error: expect.stringContaining("connection reset"),
      });
   });

   it("writes always-recorded entries as if the log were on", async () => {
      await record(
         res(false),
         { action: "credentials.update" },
         { always: true }
      );
      expect(h.writeAudits).toHaveBeenCalledWith(
         expect.objectContaining({
            audit: { enabled: true, level: "ALL" },
            entries: [{ action: "credentials.update" }],
         })
      );
   });

   it("settles a recordManyFor the same way", async () => {
      h.writeAudits.mockRejectedValue(new Error("connection reset"));
      await expect(
         recordManyFor(
            { id: "invitee", email: "invitee@example.com" },
            "server12345",
            { enabled: true, level: "ALL" } as never,
            [{ action: "invite.accept" }]
         )
      ).resolves.toBeUndefined();
      expect(h.error).toHaveBeenCalledOnce();
   });
});

describe("before the action", () => {
   it.each(["object.download", "object.archive", "audit.export"] as const)(
      "turns a failed %s write into a 503 and logs nothing extra",
      async (action) => {
         h.writeAudits.mockRejectedValue(new Error("connection reset"));
         await expect(record(res(true), { action })).rejects.toMatchObject({
            status: 503,
            message: auditUnavailable().message,
         });
         expect(h.error).not.toHaveBeenCalled();
      }
   );

   it("applies to a transfer's download attempt too", async () => {
      h.writeAudits.mockRejectedValue(new Error("connection reset"));
      await expect(
         recordManyFor(
            { id: "actor12345", email: "actor@example.com" },
            "server12345",
            { enabled: true, level: "ALL" } as never,
            [{ action: "object.download" }]
         )
      ).rejects.toMatchObject({ status: 503 });
   });
});

describe("recordWithin", () => {
   it("appends in the caller's transaction and lets a failure roll it back", async () => {
      const tx = {} as never;
      await recordWithin(tx, res(false), { action: "server.delete" });
      expect(h.appendAuditWithin).toHaveBeenCalledWith(
         tx,
         {
            serverId: "server12345",
            actor: { id: "actor12345", email: "actor@example.com" },
         },
         [{ action: "server.delete" }]
      );
      h.appendAuditWithin.mockRejectedValue(new Error("deadlock"));
      await expect(
         recordWithin(tx, res(false), { action: "server.delete" })
      ).rejects.toThrow("deadlock");
   });
});
