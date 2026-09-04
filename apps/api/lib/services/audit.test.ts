import { logger } from "@/lib/logger";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordAudit } from "./audit";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("@s3-viewer/db", () => ({ prisma: { auditLog: { create } } }));

const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});

beforeEach(() => {
   create.mockReset();
   warn.mockClear();
});

describe("recordAudit", () => {
   it("writes the entry it was handed", async () => {
      create.mockResolvedValueOnce({ id: "audit_1" });
      await recordAudit({
         action: "object.delete",
         actorId: "user_1",
         serverId: "server_1",
         target: "photos (3 objects)",
      });
      expect(create).toHaveBeenCalledWith({
         data: {
            action: "object.delete",
            actorId: "user_1",
            serverId: "server_1",
            target: "photos (3 objects)",
         },
         select: { id: true },
      });
   });

   it("nulls the fields a caller left out", async () => {
      create.mockResolvedValueOnce({ id: "audit_2" });
      await recordAudit({ action: "invite.accept", actorId: "user_1" });
      expect(create).toHaveBeenCalledWith({
         data: {
            action: "invite.accept",
            actorId: "user_1",
            serverId: null,
            target: null,
         },
         select: { id: true },
      });
   });

   it("warns instead of throwing when the insert fails", async () => {
      create.mockRejectedValueOnce(new Error("connection terminated"));
      await expect(
         recordAudit({ action: "server.delete", actorId: "user_1" })
      ).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith("Could not record audit entry", {
         action: "server.delete",
         error: "Error: connection terminated",
      });
   });
});
