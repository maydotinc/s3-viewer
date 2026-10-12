import express from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "@/lib/http";
import { routeServer, signedIn } from "@/lib/testing/route-harness";
import { Role } from "@s3-viewer/types";

const INVITEE = "invitee@example.com";
const USER = "user123456";
const SERVER = "server12345";

const state = vi.hoisted(() => ({
   email: "invitee@example.com",
   auditEnabled: true,
   grants: [] as {
      bucketName: string;
      role: string;
      restrictedFolders: boolean;
      allowedFolders: string[];
   }[],
   held: [] as {
      bucketName: string;
      role: string;
      restrictedFolders: boolean;
      allowedFolders: string[];
   }[],
   grantable: true,
   ungrantable: new Set<string>(),
   deleted: 1,
   writeAudit: vi.fn(),
   grantServerRole: vi.fn(),
   findReceived: vi.fn(async () => [] as unknown[]),
   findSent: vi.fn(async () => [] as unknown[]),
}));

vi.mock("@/lib/audit/writer", () => ({
   recentlySeen: vi.fn(() => false),
   writeAudit: state.writeAudit,
   writeAudits: vi.fn(),
}));

vi.mock("@/lib/services/servers", async (original) => ({
   ...(await original<typeof import("@/lib/services/servers")>()),
   lockBucketScope: async () => ({
      restrictedBuckets: false,
      allowedBuckets: [],
   }),
}));

vi.mock("@/lib/services/invite-authority", () => ({
   revokeInvalidInvites: vi.fn(),
   senderCanStillGrant: async () => state.grantable,
   stillGrantable: async (_db: unknown, rows: { id: string }[]) =>
      rows.filter(({ id }) => !state.ungrantable.has(id)),
}));

vi.mock("@/lib/services/invites", async (original) => ({
   ...(await original<typeof import("@/lib/services/invites")>()),
   receivedInvitePage: state.findReceived,
   sentInvitePage: state.findSent,
   grantServerRole: state.grantServerRole,
   grantBucketRoles: async () =>
      state.grants.map(
         ({ bucketName, role, restrictedFolders, allowedFolders }) => ({
            bucketName,
            role,
            folders: restrictedFolders ? allowedFolders : null,
         })
      ),
}));

vi.mock("@/lib/services/members", async (original) => ({
   ...(await original<typeof import("@/lib/services/members")>()),
   loadBucketGrants: async () => state.held,
}));

const serverRow = () => ({
   id: SERVER,
   name: "Server",
   provider: "S3",
   credentials: "encrypted",
   ownerId: "owner12345",
   auditEnabled: state.auditEnabled,
   auditViewRole: "ADMIN",
   auditManageRole: "ADMIN",
   auditRetentionDays: 0,
   auditLevel: "ALL",
});

type FindArgs = { select: Record<string, unknown> };

const findUnique = async ({ select }: FindArgs) => {
   if (select.role)
      return {
         email: state.email,
         role: "EDITOR",
         expiresAt: new Date("2030-01-01T00:00:00.000Z"),
         serverId: SERVER,
         invitedById: "sender1234",
         server: serverRow(),
         bucketAccess: state.grants,
      };
   if (select.server)
      return {
         serverId: SERVER,
         server: { auditEnabled: state.auditEnabled, auditLevel: "ALL" },
      };
   return { serverId: SERVER, email: state.email };
};

const deleteMany = async () => ({ count: state.deleted });

vi.mock("@s3-viewer/db", () => {
   const pendingInvitation = {
      findUnique,
      deleteMany,
   };
   return {
      prisma: {
         pendingInvitation,
         $transaction: async (work: (client: unknown) => Promise<unknown>) =>
            work({ pendingInvitation }),
      },
   };
});

const { invitesRouter } = await import("./invites");

let base: string;
let listBase: string;

routeServer(
   (app) => {
      app.use(express.json());
      app.use(signedIn(() => ({ id: USER, email: INVITEE, name: "Invitee" })));
      app.use("/invites", invitesRouter);
      app.use(errorHandler);
   },
   (origin) => {
      base = `${origin}/invites/invite12345`;
      listBase = `${origin}/invites`;
   }
);

beforeEach(() => {
   state.email = INVITEE;
   state.auditEnabled = true;
   state.grants = [];
   state.held = [];
   state.grantable = true;
   state.ungrantable = new Set();
   state.deleted = 1;
   state.writeAudit.mockReset().mockResolvedValue(undefined);
   state.grantServerRole.mockReset().mockResolvedValue(Role.EDITOR);
   state.findReceived.mockReset().mockResolvedValue([]);
   state.findSent.mockReset().mockResolvedValue([]);
});

const post = (action: "accept" | "reject") =>
   fetch(`${base}/${action}`, { method: "POST" });

const written = () => state.writeAudit.mock.calls[0]?.[0];

const receivedRow = (id: string, createdAt: string) => ({
   id,
   createdAt: new Date(createdAt),
   email: INVITEE,
   role: "EDITOR",
   expiresAt: new Date("2030-01-01T00:00:00.000Z"),
   serverId: SERVER,
   invitedById: "sender1234",
   server: { id: SERVER, name: "Server" },
   invitedBy: { name: "Sender", email: "sender@example.com" },
   bucketAccess: [],
});

describe("GET /invites", () => {
   it("requests one row past the default limit and hands back no cursor when that's all there is", async () => {
      state.findReceived.mockResolvedValue([
         receivedRow("i1", "2026-09-01T00:00:00.000Z"),
      ]);
      const res = await fetch(listBase);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
         invites: unknown[];
         nextCursor: unknown;
      };
      expect(body.invites).toHaveLength(1);
      expect(body.nextCursor).toBeNull();
      expect(state.findReceived).toHaveBeenCalledWith(INVITEE, undefined, 51);
   });

   it("returns a cursor for the last row of the page when more remain", async () => {
      state.findReceived.mockResolvedValue([
         receivedRow("i1", "2026-09-02T00:00:00.000Z"),
         receivedRow("i2", "2026-09-01T00:00:00.000Z"),
      ]);
      const res = await fetch(`${listBase}?limit=1`);
      const body = (await res.json()) as {
         invites: unknown[];
         nextCursor: string;
      };
      expect(body.invites).toHaveLength(1);
      expect(body.nextCursor).toBe(
         Buffer.from("2026-09-02T00:00:00.000Z|i1").toString("base64url")
      );
   });

   it("keeps reading past invites the sender can no longer grant so a page is never short", async () => {
      state.ungrantable = new Set(["i1", "i2"]);
      state.findReceived
         .mockResolvedValueOnce([
            receivedRow("i1", "2026-09-04T00:00:00.000Z"),
            receivedRow("i2", "2026-09-03T00:00:00.000Z"),
         ])
         .mockResolvedValueOnce([
            receivedRow("i3", "2026-09-02T00:00:00.000Z"),
            receivedRow("i4", "2026-09-01T00:00:00.000Z"),
         ]);
      const res = await fetch(`${listBase}?limit=1`);
      const body = (await res.json()) as {
         invites: { id: string }[];
         nextCursor: string;
      };
      expect(body.invites.map(({ id }) => id)).toEqual(["i3"]);
      expect(body.nextCursor).toBe(
         Buffer.from("2026-09-02T00:00:00.000Z|i3").toString("base64url")
      );
      expect(state.findReceived).toHaveBeenLastCalledWith(
         INVITEE,
         expect.objectContaining({ id: "i2" }),
         2
      );
   });

   it("stops refilling after five reads and hands back the last scanned row as the cursor", async () => {
      let read = 0;
      state.findReceived.mockImplementation(async () => {
         read++;
         state.ungrantable.add(`a${read}`).add(`b${read}`);
         return [
            receivedRow(`a${read}`, "2026-09-02T00:00:00.000Z"),
            receivedRow(`b${read}`, "2026-09-01T00:00:00.000Z"),
         ];
      });
      const res = await fetch(`${listBase}?limit=1`);
      const body = (await res.json()) as {
         invites: unknown[];
         nextCursor: string;
      };
      expect(state.findReceived).toHaveBeenCalledTimes(5);
      expect(body.invites).toEqual([]);
      expect(body.nextCursor).toBe(
         Buffer.from("2026-09-01T00:00:00.000Z|b5").toString("base64url")
      );
   });

   it("decodes a cursor into a descending row-value filter", async () => {
      const cursor = Buffer.from("2026-09-01T00:00:00.000Z|i2").toString(
         "base64url"
      );
      await fetch(`${listBase}?cursor=${cursor}`);
      expect(state.findReceived).toHaveBeenCalledWith(
         INVITEE,
         { createdAt: new Date("2026-09-01T00:00:00.000Z"), id: "i2" },
         51
      );
   });

   it("rejects a garbage cursor with 400", async () => {
      const res = await fetch(`${listBase}?cursor=not-valid`);
      expect(res.status).toBe(400);
   });

   it("rejects a limit above the maximum page size", async () => {
      const res = await fetch(`${listBase}?limit=1000`);
      expect(res.status).toBe(400);
      expect(state.findReceived).not.toHaveBeenCalled();
   });
});

describe("GET /invites/sent", () => {
   it("asks for one row past the limit on servers the sender still manages", async () => {
      state.findSent.mockResolvedValue([
         receivedRow("s1", "2026-09-01T00:00:00.000Z"),
      ]);
      const res = await fetch(`${listBase}/sent`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
         invites: unknown[];
         nextCursor: unknown;
      };
      expect(body.invites).toHaveLength(1);
      expect(body.nextCursor).toBeNull();
      expect(state.findSent).toHaveBeenCalledWith(
         USER,
         [Role.OWNER, Role.ADMIN],
         undefined,
         51
      );
   });

   it("returns a cursor for the last row of the page when more remain", async () => {
      state.findSent.mockResolvedValue([
         receivedRow("s1", "2026-09-02T00:00:00.000Z"),
         receivedRow("s2", "2026-09-01T00:00:00.000Z"),
      ]);
      const res = await fetch(`${listBase}/sent?limit=1`);
      const body = (await res.json()) as {
         invites: unknown[];
         nextCursor: string;
      };
      expect(body.invites).toHaveLength(1);
      expect(body.nextCursor).toBe(
         Buffer.from("2026-09-02T00:00:00.000Z|s1").toString("base64url")
      );
   });

   it("decodes a cursor into the position the next page seeks past", async () => {
      const cursor = Buffer.from("2026-09-01T00:00:00.000Z|s2").toString(
         "base64url"
      );
      await fetch(`${listBase}/sent?cursor=${cursor}`);
      expect(state.findSent).toHaveBeenCalledWith(
         USER,
         [Role.OWNER, Role.ADMIN],
         { createdAt: new Date("2026-09-01T00:00:00.000Z"), id: "s2" },
         51
      );
   });

   it("rejects a garbage cursor with 400", async () => {
      const res = await fetch(`${listBase}/sent?cursor=not-valid`);
      expect(res.status).toBe(400);
   });

   it("rejects a limit above the maximum page size", async () => {
      const res = await fetch(`${listBase}/sent?limit=1000`);
      expect(res.status).toBe(400);
      expect(state.findSent).not.toHaveBeenCalled();
   });
});

describe("POST /invites/:inviteId/accept", () => {
   it("records the acceptance against the invitation's server, as the invitee", async () => {
      state.grants = [
         {
            bucketName: "beta",
            role: "VIEWER",
            restrictedFolders: false,
            allowedFolders: [],
         },
         {
            bucketName: "alpha",
            role: "EDITOR",
            restrictedFolders: false,
            allowedFolders: [],
         },
      ];
      const res = await post("accept");
      expect(res.status).toBe(200);
      expect(written()).toEqual({
         serverId: SERVER,
         actor: { id: USER, email: INVITEE },
         audit: { enabled: true, level: "ALL" },
         entry: {
            action: "invite.accept",
            detail: {
               role: Role.EDITOR,
               buckets: "alpha:EDITOR,beta:VIEWER",
            },
         },
      });
   });

   it("leaves buckets out of the detail when the invite carries no grant", async () => {
      expect((await post("accept")).status).toBe(200);
      expect(written().entry).toEqual({
         action: "invite.accept",
         detail: { role: Role.EDITOR },
      });
   });

   it("carries the server's own audit setting", async () => {
      state.auditEnabled = false;
      expect((await post("accept")).status).toBe(200);
      expect(written().audit).toEqual({ enabled: false, level: "ALL" });
   });

   it("records the role actually granted, not the invited one", async () => {
      state.grantServerRole.mockResolvedValue(Role.ADMIN);
      expect((await post("accept")).status).toBe(200);
      expect(written().entry.detail).toEqual({ role: Role.ADMIN });
   });

   it("refuses an invite that would make a folder-limited member an admin", async () => {
      state.grantServerRole.mockResolvedValue(Role.ADMIN);
      state.held = [
         {
            bucketName: "company",
            role: "EDITOR",
            restrictedFolders: true,
            allowedFolders: ["landing/"],
         },
      ];
      const res = await post("accept");
      expect(res.status).toBe(409);
      await expect(res.json()).resolves.toMatchObject({
         message: expect.stringContaining("company is limited to folders"),
      });
      expect(state.writeAudit).not.toHaveBeenCalled();
   });

   it("records the folders an accepted grant is limited to", async () => {
      state.grants = [
         {
            bucketName: "company",
            role: "EDITOR",
            restrictedFolders: true,
            allowedFolders: ["landing/", "a b, c/"],
         },
      ];
      expect((await post("accept")).status).toBe(200);
      expect(written().entry.detail).toMatchObject({
         buckets: 'company:EDITOR["landing/","a b, c/"]',
      });
   });

   it("records nothing for an invite addressed to another account", async () => {
      state.email = "someone@example.com";
      expect((await post("accept")).status).toBe(404);
      expect(state.writeAudit).not.toHaveBeenCalled();
   });

   it("records nothing when the sender can no longer grant it", async () => {
      state.grantable = false;
      expect((await post("accept")).status).toBe(404);
      expect(state.writeAudit).not.toHaveBeenCalled();
   });
});

describe("POST /invites/:inviteId/reject", () => {
   it("records the rejection against the invitation's server", async () => {
      expect((await post("reject")).status).toBe(204);
      expect(written()).toEqual({
         serverId: SERVER,
         actor: { id: USER, email: INVITEE },
         audit: { enabled: true, level: "ALL" },
         entry: { action: "invite.reject" },
      });
   });

   it("records nothing when no invite of that id is addressed here", async () => {
      state.deleted = 0;
      expect((await post("reject")).status).toBe(404);
      expect(state.writeAudit).not.toHaveBeenCalled();
   });
});
