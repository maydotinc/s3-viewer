import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCK_NAMESPACE } from "@/lib/db-locks";
import { errorHandler } from "@/lib/http";
import { Prisma } from "@prisma/client";
import {
   routeServer,
   scopeQueryRaw,
   signedIn,
} from "@/lib/testing/route-harness";
import type { DbRole } from "@/lib/testing/scope-probe";

type Row = { email: string; role: DbRole; bucketAccess?: { role: DbRole }[] };

const ACTOR = "actor12345";
const SERVER = "server12345";

const state = vi.hoisted(() => ({
   actor: "actor12345",
   role: "OWNER" as DbRole | null,
   members: [] as string[],
   pending: [] as { email: string; role: string; token?: string }[],
   written: [] as { email: string; role: string }[],
   tokens: new Map<string, string>(),
   grantRows: [] as {
      invitationId: string;
      bucketName: string;
      role: string;
      restrictedFolders: boolean;
      allowedFolders: string[];
   }[],
   record: vi.fn(),
   recordMany: vi.fn(),
   sendEmail: vi.fn(),
   lockRaw: vi.fn(),
   beforeScopeLock: vi.fn(),
   deleteInvites: vi.fn(),
   deleteGrants: vi.fn(),
   writeAudit: vi.fn(),
   reserve: undefined as
      | undefined
      | ((
           serverId: string,
           email: string
        ) => Promise<{ release: () => Promise<void> } | null>),
}));

vi.mock("@/lib/audit/writer", async (original) => ({
   ...(await original<typeof import("@/lib/audit/writer")>()),
   writeAudit: state.writeAudit,
   recentlySeen: () => false,
}));

vi.mock("@/lib/middleware/audit-record", () => ({
   record: state.record,
   recordAlways: vi.fn(),
   recordMany: state.recordMany,
}));

vi.mock("@s3-viewer/email", () => ({ sendServerInviteEmail: state.sendEmail }));
vi.mock("@/lib/services/invite-email-budget", async (original) => ({
   ...(await original<typeof import("@/lib/services/invite-email-budget")>()),
   reserveInviteEmail: (serverId: string, email: string) =>
      state.reserve!(serverId, email),
}));
vi.mock("@/lib/middleware/rate-limit", async (original) => ({
   ...(await original<typeof import("@/lib/middleware/rate-limit")>()),
   inviteLimit: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("@/lib/services/servers", async (original) => ({
   ...(await original<typeof import("@/lib/services/servers")>()),
   lockBucketScope: async () => {
      await state.beforeScopeLock();
      return { restrictedBuckets: false, allowedBuckets: [] };
   },
}));

vi.mock("@/lib/services/members", async (original) => ({
   ...(await original<typeof import("@/lib/services/members")>()),
   loadGrantingActor: async () => ({
      serverRole: "OWNER",
      bucketGrants: new Map(),
   }),
   assertBucketGrants: () => undefined,
}));

const inviteId = (email: string) => `inv${email.replace(/\W/g, "")}`;

const roleOf = (email: string) =>
   state.written.find((row) => row.email === email)?.role ??
   state.pending.find((row) => row.email === email)?.role ??
   "VIEWER";

const tokenOf = (email: string) =>
   state.tokens.get(email) ??
   state.pending.find((row) => row.email === email)?.token ??
   `stored-${inviteId(email)}`;

const fullRow = (email: string, withToken = false) => ({
   id: inviteId(email),
   ...(withToken && { token: tokenOf(email) }),
   email,
   role: roleOf(email),
   expiresAt: new Date("2030-01-01T00:00:00.000Z"),
   serverId: SERVER,
   invitedById: ACTOR,
   server: { id: SERVER, name: "Server" },
   invitedBy: { name: "Actor", email: "actor@example.com" },
   bucketAccess: state.grantRows
      .filter((grant) => grant.invitationId === inviteId(email))
      .map(({ bucketName, role, restrictedFolders, allowedFolders }) => ({
         bucketName,
         role,
         restrictedFolders,
         allowedFolders,
      })),
});

type FindManyArgs = {
   where: { email?: { in?: string[] } };
   select: Record<string, unknown>;
};

const pendingFindMany = async ({ where, select }: FindManyArgs) => {
   const asked = where.email?.in ?? state.pending.map((row) => row.email);
   const known = asked.filter((email) =>
      state.pending.some((row) => row.email === email)
   );
   if (select.server)
      return asked.map((email) => fullRow(email, select.token === true));
   if (select.role)
      return known.map((email) => ({
         email,
         role: roleOf(email),
         bucketAccess: fullRow(email).bucketAccess,
      }));
   if (select.id && select.email)
      return known.map((email) => ({
         id: inviteId(email),
         email,
         token: tokenOf(email),
      }));
   if (select.email) return known.map((email) => ({ email }));
   return asked.map((email) => ({ id: inviteId(email) }));
};

const access = async () => (state.role ? { role: state.role } : null);

const accessWithServer = async () =>
   state.role ? { role: state.role, server: { auditEnabled: true } } : null;

const revoked = vi.hoisted(() => ({ target: null as Row | null }));

vi.mock("@s3-viewer/db", () => {
   const pendingInvitation = {
      findMany: pendingFindMany,
      createManyAndReturn: async ({
         data,
      }: {
         data: { email: string; role: string; token: string }[];
      }) => {
         state.written.push(...data);
         for (const row of data) state.tokens.set(row.email, row.token);
         return data.map(({ email }) => ({ id: inviteId(email) }));
      },
      updateMany: async ({
         where,
         data,
      }: {
         where: { email: { in: string[] } };
         data: { role: string };
      }) => {
         state.written.push(
            ...where.email.in.map((email) => ({ email, role: data.role }))
         );
         return { count: where.email.in.length };
      },
      deleteMany: state.deleteInvites,
      count: async () => state.pending.length,
      findUnique: async () =>
         revoked.target
            ? {
                 ...revoked.target,
                 bucketAccess: revoked.target.bucketAccess ?? [],
              }
            : null,
   };
   const tx = {
      $queryRaw: state.lockRaw,
      serverAccess: {
         findUnique: access,
         findMany: async () =>
            state.members.map((email) => ({ user: { email } })),
      },
      pendingInvitation,
      invitationBucketAccess: {
         deleteMany: state.deleteGrants,
         createMany: async ({
            data,
         }: {
            data: {
               invitationId: string;
               bucketName: string;
               role: string;
               restrictedFolders: boolean;
               allowedFolders: string[];
            }[];
         }) => {
            state.grantRows.push(...data);
            return { count: data.length };
         },
      },
   };
   return {
      prisma: {
         $queryRaw: scopeQueryRaw(() =>
            state.role ? { role: state.role, auditEnabled: true } : null
         ),
         serverAccess: { findUnique: accessWithServer },
         pendingInvitation,
         $transaction: async (work: (client: unknown) => Promise<unknown>) =>
            work(tx),
      },
   };
});

// static import would run the database mock factory before its fixture constants exist.
const { serverInvitesRouter } = await import("./invites");
const { inviteEmailBudget, memoryCounter } = await import(
   "@/lib/services/invite-email-budget"
);
const { recordDenials } = await import("@/lib/middleware/route");

let base: string;
routeServer(
   (app) => {
      app.use(express.json());
      app.use(signedIn(() => ({ id: state.actor })));
      app.use("/servers", serverInvitesRouter);
      app.use(recordDenials);
      app.use(errorHandler);
   },
   (origin) => {
      base = `${origin}/servers/${SERVER}/invites`;
   }
);

beforeEach(() => {
   state.actor = ACTOR;
   state.role = "OWNER";
   state.members = [];
   state.pending = [];
   state.written = [];
   state.tokens.clear();
   state.grantRows = [];
   revoked.target = { email: "invitee@example.com", role: "VIEWER" };
   state.record.mockReset().mockResolvedValue(undefined);
   state.recordMany.mockReset().mockResolvedValue(undefined);
   state.sendEmail.mockReset().mockResolvedValue(undefined);
   state.lockRaw.mockReset().mockResolvedValue([{ locked: true }]);
   state.beforeScopeLock.mockReset();
   state.deleteInvites.mockReset().mockResolvedValue({ count: 1 });
   state.deleteGrants.mockReset().mockResolvedValue({ count: 0 });
   state.writeAudit.mockReset().mockResolvedValue(undefined);
   const counter = memoryCounter();
   state.reserve = inviteEmailBudget(() => counter);
});

const send = (body: Record<string, unknown>) =>
   fetch(base, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
   });

const entries = () => state.recordMany.mock.calls[0]?.[1];

const linkFor = (email: string): URL => {
   const sent = state.sendEmail.mock.calls
      .map(([message]) => message as { to: string; invitesUrl: string })
      .find((message) => message.to === email);
   return new URL(sent?.invitesUrl ?? "http://missing.invalid");
};

const lockSql = (): Prisma.Sql => {
   const [strings, ...values] = (state.lockRaw.mock.calls[0] ?? []) as [
      TemplateStringsArray,
      ...unknown[],
   ];
   return Prisma.sql(strings, ...values);
};

describe("POST /servers/:serverId/invites", () => {
   it("refuses replacing lower-role invites carrying protected bucket grants", async () => {
      state.role = "ADMIN";
      state.pending = [{ email: "one@example.com", role: "VIEWER" }];
      state.grantRows = [
         {
            invitationId: inviteId("one@example.com"),
            bucketName: "photos",
            role: "ADMIN",
            restrictedFolders: false,
            allowedFolders: [],
         },
      ];
      const response = await send({
         emails: ["one@example.com"],
         role: "VIEWER",
         bucketAccess: [
            { bucketName: "photos", role: "VIEWER", folders: null },
         ],
      });
      expect(response.status).toBe(403);
      expect(state.written).toEqual([]);
      expect(state.deleteGrants).not.toHaveBeenCalled();
      expect(state.deleteInvites).not.toHaveBeenCalled();
      expect(state.sendEmail).not.toHaveBeenCalled();
      expect(state.writeAudit).toHaveBeenCalledWith(
         expect.objectContaining({
            entry: expect.objectContaining({
               action: "access.denied",
               detail: { permission: "MANAGE_MEMBERS", reason: "member" },
            }),
         })
      );
   });

   it("allows an owner to replace the protected invitation", async () => {
      state.pending = [{ email: "one@example.com", role: "VIEWER" }];
      state.grantRows = [
         {
            invitationId: inviteId("one@example.com"),
            bucketName: "photos",
            role: "ADMIN",
            restrictedFolders: false,
            allowedFolders: [],
         },
      ];
      expect(
         (
            await send({
               emails: ["one@example.com"],
               role: "VIEWER",
               bucketAccess: [
                  { bucketName: "photos", role: "VIEWER", folders: null },
               ],
            })
         ).status
      ).toBe(200);
      expect(state.deleteGrants).toHaveBeenCalledOnce();
      expect(state.written).toHaveLength(1);
   });

   it("records one row per invite it creates, with the role and grants", async () => {
      const res = await send({
         emails: ["one@example.com", "two@example.com"],
         role: "EDITOR",
         bucketAccess: [
            { bucketName: "beta", role: "VIEWER", folders: null },
            { bucketName: "alpha", role: "EDITOR", folders: null },
         ],
      });
      expect(res.status).toBe(200);
      expect(entries()).toEqual([
         {
            action: "invite.send",
            target: "one@example.com",
            detail: { role: "EDITOR", buckets: "alpha:EDITOR,beta:VIEWER" },
         },
         {
            action: "invite.send",
            target: "two@example.com",
            detail: { role: "EDITOR", buckets: "alpha:EDITOR,beta:VIEWER" },
         },
      ]);
   });

   it("records nothing for an address that is already a member", async () => {
      state.members = ["member@example.com"];
      const res = await send({
         emails: ["member@example.com"],
         role: "VIEWER",
         bucketAccess: [{ bucketName: "alpha", role: "VIEWER", folders: null }],
      });
      expect(await res.json()).toMatchObject({
         invites: [],
         alreadyMembers: ["member@example.com"],
      });
      expect(entries()).toEqual([]);
      expect(state.sendEmail).not.toHaveBeenCalled();
   });

   it("takes the invite-send lock rather than the shared single-key one", async () => {
      await send({
         emails: ["one@example.com"],
         role: "EDITOR",
         bucketAccess: [{ bucketName: "alpha", role: "VIEWER", folders: null }],
      });
      const sql = lockSql();
      expect(sql.text.replace(/\s+/g, " ").trim()).toBe(
         "SELECT pg_try_advisory_xact_lock( $1::int4, hashtext($2) ) AS locked"
      );
      expect(sql.values).toEqual([LOCK_NAMESPACE.INVITE_SEND, SERVER]);
   });

   it("refuses a send while another holds that server's invite lock", async () => {
      state.lockRaw.mockResolvedValue([{ locked: false }]);
      const res = await send({
         emails: ["one@example.com"],
         role: "EDITOR",
         bucketAccess: [{ bucketName: "alpha", role: "VIEWER", folders: null }],
      });
      expect(res.status).toBe(409);
      expect(state.recordMany).not.toHaveBeenCalled();
   });

   it("records nothing when the actor may not grant that role", async () => {
      state.role = "ADMIN";
      const res = await send({
         emails: ["one@example.com"],
         role: "ADMIN",
         bucketAccess: [{ bucketName: "alpha", role: "VIEWER", folders: null }],
      });
      expect(res.status).toBe(403);
      expect(state.recordMany).not.toHaveBeenCalled();
   });

   it("emails each new invite its own random token and keeps it out of the response and the audit rows", async () => {
      const res = await send({
         emails: ["one@example.com", "two@example.com"],
         role: "VIEWER",
         bucketAccess: [{ bucketName: "alpha", role: "VIEWER", folders: null }],
      });
      expect(res.status).toBe(200);
      const body = await res.text();
      const tokens = ["one@example.com", "two@example.com"].map(
         (email) => state.tokens.get(email) ?? ""
      );
      expect(new Set(tokens).size).toBe(2);
      for (const [index, email] of [
         "one@example.com",
         "two@example.com",
      ].entries()) {
         const token = tokens[index] ?? "";
         expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
         expect(linkFor(email).searchParams.get("invite")).toBe(token);
         expect(linkFor(email).pathname).toBe("/settings/invites");
         expect(body).not.toContain(token);
         expect(JSON.stringify(entries())).not.toContain(token);
      }
      expect(JSON.parse(body).invites[0]).not.toHaveProperty("token");
   });

   it("re-sends an existing invite with the token it already has", async () => {
      state.pending = [
         { email: "one@example.com", role: "VIEWER", token: "kept-token-1" },
      ];
      const res = await send({
         emails: ["one@example.com"],
         role: "EDITOR",
         bucketAccess: [{ bucketName: "alpha", role: "VIEWER", folders: null }],
      });
      expect(res.status).toBe(200);
      expect(state.tokens.size).toBe(0);
      expect(linkFor("one@example.com").searchParams.get("invite")).toBe(
         "kept-token-1"
      );
   });
});

describe("invite emails", () => {
   const viewerInvite = (emails: string[]) => ({
      emails,
      role: "VIEWER",
      bucketAccess: [{ bucketName: "alpha", role: "VIEWER", folders: null }],
   });

   const inviteOn = async (server: string, emails: string[]) => {
      const res = await fetch(base.replace(SERVER, server), {
         method: "POST",
         headers: { "content-type": "application/json" },
         body: JSON.stringify(viewerInvite(emails)),
      });
      expect(res.status).toBe(200);
      return (await res.json()) as {
         invites: { email: string; emailed: boolean }[];
      };
   };

   const fromSenders = async (emails: string[]) => {
      const flags: boolean[] = [];
      for (const [index, email] of emails.entries()) {
         state.actor = `sender${index}abcdef`;
         const { invites } = await inviteOn(`server${index}abcdef`, [email]);
         flags.push(invites[0]!.emailed);
      }
      return flags;
   };

   beforeEach(() => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
   });

   afterEach(() => {
      vi.restoreAllMocks();
   });

   it("marks each invite as emailed and names the inviter's address", async () => {
      const body = await inviteOn(SERVER, [
         "one@example.com",
         "two@example.com",
      ]);
      expect(
         body.invites.map(({ email, emailed }) => [email, emailed])
      ).toEqual([
         ["one@example.com", true],
         ["two@example.com", true],
      ]);
      expect(state.sendEmail).toHaveBeenCalledWith(
         expect.objectContaining({
            inviterName: "Actor",
            inviterEmail: "actor@example.com",
         })
      );
   });

   it("saves a repeat invite inside the cooldown without emailing again", async () => {
      await inviteOn(SERVER, ["one@example.com"]);
      state.pending = [{ email: "one@example.com", role: "VIEWER" }];
      const again = await inviteOn(SERVER, ["one@example.com"]);
      expect(state.sendEmail).toHaveBeenCalledOnce();
      expect(again.invites).toMatchObject([
         { email: "one@example.com", emailed: false },
      ]);
      expect(state.written.map(({ email }) => email)).toEqual([
         "one@example.com",
         "one@example.com",
      ]);
   });

   it("stops emailing one address after three invites a day from different senders", async () => {
      expect(await fromSenders(Array(4).fill("victim@example.com"))).toEqual([
         true,
         true,
         true,
         false,
      ]);
      expect(state.sendEmail).toHaveBeenCalledTimes(3);
      expect(state.written).toHaveLength(4);
   });

   it("counts plus tags and gmail dots against one mailbox", async () => {
      expect(
         await fromSenders([
            "victim+a@gmail.com",
            "victim+b@gmail.com",
            "vic.tim@googlemail.com",
            "victim@gmail.com",
            "victim@example.com",
         ])
      ).toEqual([true, true, true, false, true]);
   });

   it("stops emailing for a server after fifty invite emails a day", async () => {
      const flags: boolean[] = [];
      for (let batch = 0; batch < 11; batch++) {
         const emails = Array.from(
            { length: 5 },
            (_unused, index) => `person${batch * 5 + index}@example.com`
         );
         const { invites } = await inviteOn(SERVER, emails);
         flags.push(...invites.map(({ emailed }) => emailed));
      }
      expect(flags.filter(Boolean)).toHaveLength(50);
      expect(flags.slice(50)).toEqual([false, false, false, false, false]);
   });

   it("reports and logs a failed send instead of claiming it went out", async () => {
      state.sendEmail.mockImplementation(async ({ to }: { to: string }) => {
         if (to === "one@example.com")
            throw new Error("Email delivery is busy");
      });
      const body = await inviteOn(SERVER, [
         "one@example.com",
         "two@example.com",
      ]);
      expect(body.invites.map(({ emailed }) => emailed)).toEqual([false, true]);
      expect(
         vi
            .mocked(console.error)
            .mock.calls.some(([line]) =>
               String(line).includes("Invite email failed")
            )
      ).toBe(true);
      state.sendEmail.mockResolvedValue(undefined);
      const retried = await inviteOn(SERVER, ["one@example.com"]);
      expect(retried.invites[0]?.emailed).toBe(true);
   });
});

describe("GET /servers/:serverId/invites", () => {
   it("lists pending invites without reading or returning their tokens", async () => {
      state.pending = [
         { email: "one@example.com", role: "VIEWER", token: "kept-token-1" },
      ];
      const res = await fetch(base);
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(JSON.parse(body).invites).toHaveLength(1);
      expect(body).not.toContain("token");
   });
});

describe("DELETE /servers/:serverId/invites/:inviteId", () => {
   it.each(["ADMIN", "OWNER"] as const)(
      "checks %s authority over all invitation grants",
      async (role) => {
         state.role = role;
         revoked.target = {
            email: "invitee@example.com",
            role: "VIEWER",
            bucketAccess: [{ role: "ADMIN" }],
         };
         expect(
            (await fetch(`${base}/invite12345`, { method: "DELETE" })).status
         ).toBe(role === "OWNER" ? 204 : 403);
         expect(state.deleteInvites).toHaveBeenCalledTimes(
            role === "OWNER" ? 1 : 0
         );
         expect(state.writeAudit).toHaveBeenCalledTimes(
            role === "OWNER" ? 0 : 1
         );
      }
   );

   it("records the invitee's address", async () => {
      const res = await fetch(`${base}/invite12345`, { method: "DELETE" });
      expect(res.status).toBe(204);
      expect(state.record.mock.calls[0]?.[1]).toEqual({
         action: "invite.revoke",
         target: "invitee@example.com",
      });
   });

   it("records nothing for an invite that is not there", async () => {
      revoked.target = null;
      const res = await fetch(`${base}/invite12345`, { method: "DELETE" });
      expect(res.status).toBe(404);
      expect(state.record).not.toHaveBeenCalled();
   });

   it("records nothing for an invite removed before the delete landed", async () => {
      state.deleteInvites.mockResolvedValue({ count: 0 });
      const res = await fetch(`${base}/invite12345`, { method: "DELETE" });
      expect(res.status).toBe(404);
      expect(state.record).not.toHaveBeenCalled();
   });

   it("records nothing when the invite outranks the actor", async () => {
      state.role = "ADMIN";
      revoked.target = { email: "invitee@example.com", role: "ADMIN" };
      const res = await fetch(`${base}/invite12345`, { method: "DELETE" });
      expect(res.status).toBe(403);
      expect(state.record).not.toHaveBeenCalled();
   });
});

describe("invitation authority while waiting for the server lock", () => {
   it.each([
      ["replace", "protected grant added"],
      ["replace", "actor demoted"],
      ["replace", "membership removed"],
      ["revoke", "protected grant added"],
      ["revoke", "actor demoted"],
      ["revoke", "membership removed"],
   ])("rechecks %s after %s", async (operation, change) => {
      state.role = "ADMIN";
      state.pending = [{ email: "one@example.com", role: "VIEWER" }];
      let reachedLock!: () => void;
      let resume!: () => void;
      const waiting = new Promise<void>((resolve) => {
         reachedLock = resolve;
      });
      const held = new Promise<void>((resolve) => {
         resume = resolve;
      });
      state.beforeScopeLock.mockImplementationOnce(async () => {
         reachedLock();
         await held;
      });
      const response =
         operation === "replace"
            ? send({
                 emails: ["one@example.com"],
                 role: "VIEWER",
                 bucketAccess: [
                    { bucketName: "photos", role: "VIEWER", folders: null },
                 ],
              })
            : fetch(`${base}/invite12345`, { method: "DELETE" });
      await waiting;
      if (change === "protected grant added") {
         state.grantRows = [
            {
               invitationId: inviteId("one@example.com"),
               bucketName: "photos",
               role: "ADMIN",
               restrictedFolders: false,
               allowedFolders: [],
            },
         ];
         revoked.target = {
            email: "invitee@example.com",
            role: "VIEWER",
            bucketAccess: [{ role: "ADMIN" }],
         };
      }
      if (change === "actor demoted") state.role = "EDITOR";
      if (change === "membership removed") state.role = null;
      resume();
      expect((await response).status).toBe(403);
      expect(state.written).toEqual([]);
      expect(state.deleteInvites).not.toHaveBeenCalled();
      expect(state.deleteGrants).not.toHaveBeenCalled();
      expect(state.writeAudit).toHaveBeenCalledOnce();
   });
});
