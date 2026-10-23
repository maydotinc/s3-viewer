import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SERVER_NOT_FOUND } from "@/lib/constants";
import { LOCK_NAMESPACE } from "@/lib/db-locks";
import { ApiHttpError, errorHandler } from "@/lib/http";
import { Prisma } from "@prisma/client";
import { routeServer, signedIn } from "@/lib/testing/route-harness";
import type { DbRole } from "@/lib/testing/scope-probe";
import type { InviteOutcome, SendInvitesResult } from "@s3-viewer/types";

type Grant = {
   bucketName: string;
   role: DbRole;
   restrictedFolders: boolean;
   allowedFolders: string[];
};
type GrantRow = Grant & { invitationId: string };
type Pending = { email: string; role: string; token?: string };
type ServerState = {
   name: string;
   // the acting member's role on this server; null when not a member.
   role: DbRole | null;
   members: string[];
   pending: Pending[];
   written: { email: string; role: string }[];
};

const grant = (bucketName: string, role: DbRole): Grant => ({
   bucketName,
   role,
   restrictedFolders: false,
   allowedFolders: [],
});

const ACTOR = "actor12345";
const SERVER = "server12345";
const OTHER = "server2abcdef";
const SERVER_ROW = {
   restrictedBuckets: false,
   allowedBuckets: [],
   auditEnabled: true,
   auditLevel: "ALL",
};

const state = vi.hoisted(() => ({
   actor: "actor12345",
   sessionCreatedAt: Date.now(),
   servers: new Map<string, ServerState>(),
   busy: new Set<string>(),
   tokens: new Map<string, string>(),
   grantRows: [] as GrantRow[],
   held: new Map<string, { role: DbRole; folders: string[] | null }>(),
   recordManyFor: vi.fn(),
   sendEmail: vi.fn(),
   lockRaw: vi.fn(),
   beforeServerLock: vi.fn(),
   deleteInvites: vi.fn(),
   deleteGrants: vi.fn(),
   writeAudit: vi.fn(),
   reserve: undefined as
      | undefined
      | ((
           serverIds: string[],
           email: string
        ) => Promise<{
           servers: string[];
           release: () => Promise<void>;
        } | null>),
}));

const server = (id: string, overrides: Partial<ServerState> = {}): void => {
   state.servers.set(id, {
      name: id === SERVER ? "Server" : `Server ${id}`,
      role: "OWNER",
      members: [],
      pending: [],
      written: [],
      ...overrides,
   });
};

const on = (id: string): ServerState => {
   const found = state.servers.get(id);
   if (!found) throw new Error(`no server ${id} in this test`);
   return found;
};

vi.mock("@/lib/audit/writer", async (original) => ({
   ...(await original<typeof import("@/lib/audit/writer")>()),
   writeAudit: state.writeAudit,
   recentlySeen: () => false,
}));

vi.mock("@/lib/middleware/audit-record", async (original) => ({
   ...(await original<typeof import("@/lib/middleware/audit-record")>()),
   recordManyFor: state.recordManyFor,
}));

vi.mock("@s3-viewer/email", () => ({ sendServerInviteEmail: state.sendEmail }));
vi.mock("@/lib/services/invite-email-budget", async (original) => ({
   ...(await original<typeof import("@/lib/services/invite-email-budget")>()),
   reserveInviteEmails: (serverIds: string[], email: string) =>
      state.reserve!(serverIds, email),
}));
vi.mock("@/lib/middleware/rate-limit", async (original) => ({
   ...(await original<typeof import("@/lib/middleware/rate-limit")>()),
   inviteLimit: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("@/lib/services/servers", async (original) => ({
   ...(await original<typeof import("@/lib/services/servers")>()),
   lockServerRow: async (_tx: unknown, serverId: string) => {
      await state.beforeServerLock();
      if (!state.servers.has(serverId))
         throw new ApiHttpError(404, SERVER_NOT_FOUND);
      return SERVER_ROW;
   },
}));

const inviteId = (serverId: string, email: string) =>
   `inv-${serverId}-${email.replace(/\W/g, "")}`;

const tokenKey = (serverId: string, email: string) => `${serverId}|${email}`;

const roleOf = (serverId: string, email: string) =>
   on(serverId).written.find((row) => row.email === email)?.role ??
   on(serverId).pending.find((row) => row.email === email)?.role ??
   "VIEWER";

const locate = (
   id: string
): { serverId: string; email: string } | undefined => {
   for (const [serverId, { pending, written }] of state.servers) {
      const email = [...pending, ...written].find(
         (row) => inviteId(serverId, row.email) === id
      )?.email;
      if (email) return { serverId, email };
   }
   return undefined;
};

const tokenOf = (serverId: string, email: string) =>
   state.tokens.get(tokenKey(serverId, email)) ??
   on(serverId).pending.find((row) => row.email === email)?.token ??
   `stored-${inviteId(serverId, email)}`;

const fullRow = (serverId: string, email: string, withToken = false) => ({
   id: inviteId(serverId, email),
   ...(withToken && { token: tokenOf(serverId, email) }),
   email,
   role: roleOf(serverId, email),
   expiresAt: new Date("2030-01-01T00:00:00.000Z"),
   serverId,
   invitedById: ACTOR,
   server: { id: serverId, name: on(serverId).name },
   invitedBy: { name: "Actor", email: "actor@example.com" },
   bucketAccess: state.grantRows
      .filter((row) => row.invitationId === inviteId(serverId, email))
      .map(({ bucketName, role, restrictedFolders, allowedFolders }) => ({
         bucketName,
         role,
         restrictedFolders,
         allowedFolders,
      })),
});

type FindManyArgs = {
   where: { serverId: string; email?: { in?: string[] } };
   select: Record<string, unknown>;
};

const pendingFindMany = async ({ where, select }: FindManyArgs) => {
   const { serverId } = where;
   const asked =
      where.email?.in ?? on(serverId).pending.map((row) => row.email);
   const known = asked.filter((email) =>
      on(serverId).pending.some((row) => row.email === email)
   );
   if (select.server)
      return asked.map((email) =>
         fullRow(serverId, email, select.token === true)
      );
   if (select.role)
      return known.map((email) => ({
         email,
         role: roleOf(serverId, email),
         bucketAccess: fullRow(serverId, email).bucketAccess,
      }));
   if (select.id && select.email)
      return known.map((email) => ({
         id: inviteId(serverId, email),
         email,
         token: tokenOf(serverId, email),
      }));
   if (select.email) return known.map((email) => ({ email }));
   return asked.map((email) => ({ id: inviteId(serverId, email) }));
};

vi.mock("@s3-viewer/db", () => {
   const pendingInvitation = {
      findMany: pendingFindMany,
      createManyAndReturn: async ({
         data,
      }: {
         data: {
            serverId: string;
            email: string;
            role: string;
            token: string;
         }[];
      }) => {
         for (const row of data) {
            on(row.serverId).written.push(row);
            state.tokens.set(tokenKey(row.serverId, row.email), row.token);
         }
         return data.map(({ serverId, email }) => ({
            id: inviteId(serverId, email),
         }));
      },
      updateMany: async ({
         where,
         data,
      }: {
         where: {
            serverId?: string;
            email?: { in: string[] };
            id?: string;
            token?: string;
         };
         data: { role: string; token?: string };
      }) => {
         if (where.id !== undefined) {
            const found = locate(where.id);
            if (!found || tokenOf(found.serverId, found.email) !== where.token)
               return { count: 0 };
            state.tokens.set(
               tokenKey(found.serverId, found.email),
               data.token!
            );
            return { count: 1 };
         }
         const emails = where.email?.in ?? [];
         on(where.serverId!).written.push(
            ...emails.map((email) => ({ email, role: data.role }))
         );
         return { count: emails.length };
      },
      deleteMany: state.deleteInvites,
      count: async ({ where }: { where: { serverId: string } }) =>
         on(where.serverId).pending.length,
   };
   const tx = {
      $queryRaw: async (
         strings: TemplateStringsArray,
         ...values: unknown[]
      ) => {
         state.lockRaw(strings, ...values);
         const key = Prisma.sql(strings, ...values).values[1];
         return [{ locked: !state.busy.has(String(key)) }];
      },
      serverAccess: {
         findUnique: async ({
            where,
         }: {
            where: { userId_serverId: { serverId: string } };
         }) => {
            const { role } = on(where.userId_serverId.serverId);
            return role ? { role } : null;
         },
         findMany: async ({ where }: { where: { serverId: string } }) =>
            on(where.serverId).members.map((email) => ({ user: { email } })),
      },
      bucketAccess: {
         findMany: async ({
            where,
         }: {
            where: { userId: string; bucketName: { in: string[] } };
         }) =>
            [...state.held]
               .filter(
                  ([bucketName]) =>
                     where.userId === state.actor &&
                     where.bucketName.in.includes(bucketName)
               )
               .map(([bucketName, { role, folders }]) => ({
                  bucketName,
                  role,
                  restrictedFolders: folders !== null,
                  allowedFolders: folders ?? [],
               })),
      },
      pendingInvitation,
      invitationBucketAccess: {
         deleteMany: state.deleteGrants,
         createMany: async ({ data }: { data: GrantRow[] }) => {
            state.grantRows.push(...data);
            return { count: data.length };
         },
      },
   };
   return {
      prisma: {
         pendingInvitation,
         $transaction: async (work: (client: unknown) => Promise<unknown>) =>
            work(tx),
      },
   };
});

// static import would run the database mock factory before its fixture constants exist.
const { invitesRouter } = await import("./invites");
const { inviteEmailBudget, memoryCounter } = await import(
   "@/lib/services/invite-email-budget"
);

let base: string;
routeServer(
   (app) => {
      app.use(express.json());
      app.use(signedIn(() => ({ id: state.actor })));
      app.use((req, _res, next) => {
         Object.assign(req, {
            session: { createdAt: new Date(state.sessionCreatedAt) },
         });
         next();
      });
      app.use("/invites", invitesRouter);
      app.use(errorHandler);
   },
   (origin) => {
      base = `${origin}/invites`;
   }
);

beforeEach(() => {
   state.actor = ACTOR;
   state.sessionCreatedAt = Date.now();
   state.servers.clear();
   server(SERVER);
   state.busy.clear();
   state.tokens.clear();
   state.grantRows = [];
   state.held.clear();
   // the admin cases invite onto photos, so they hold it unless a test says otherwise.
   state.held.set("photos", { role: "VIEWER", folders: null });
   state.recordManyFor.mockReset().mockResolvedValue(undefined);
   state.sendEmail.mockReset().mockResolvedValue(undefined);
   state.lockRaw.mockReset();
   state.beforeServerLock.mockReset();
   state.deleteInvites.mockReset().mockResolvedValue({ count: 1 });
   state.deleteGrants.mockReset().mockResolvedValue({ count: 0 });
   state.writeAudit.mockReset().mockResolvedValue(undefined);
   const counter = memoryCounter();
   state.reserve = inviteEmailBudget(() => counter);
});

const viewerOn = (serverId: string, bucketName = "alpha") => ({
   serverId,
   role: "VIEWER",
   bucketAccess: [{ bucketName, role: "VIEWER", folders: null }],
});

const send = (body: Record<string, unknown>) =>
   fetch(base, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
   });

const sent = async (body: Record<string, unknown>) => {
   const res = await send(body);
   expect(res.status).toBe(200);
   return (await res.json()) as SendInvitesResult;
};

const outcome = async (
   body: Record<string, unknown>,
   serverId = SERVER
): Promise<InviteOutcome> => {
   const { outcomes } = await sent(body);
   const found = outcomes.find((entry) => entry.serverId === serverId);
   if (!found) throw new Error(`no outcome for ${serverId}`);
   return found;
};

type SentMessage = {
   to: string;
   invitesUrl: string;
   servers: { serverName: string; role: string }[];
};

const messages = (): SentMessage[] =>
   state.sendEmail.mock.calls.map(([message]) => message as SentMessage);

const linkFor = (email: string): URL =>
   new URL(
      messages().find((message) => message.to === email)?.invitesUrl ??
         "http://missing.invalid"
   );

const entriesFor = (serverId: string) =>
   state.recordManyFor.mock.calls.find(([, id]) => id === serverId)?.[3];

const denials = () =>
   state.writeAudit.mock.calls.map(
      ([input]) => input as { serverId: string; entry: { action: string } }
   );

const lockSql = (): Prisma.Sql => {
   const [strings, ...values] = (state.lockRaw.mock.calls[0] ?? []) as [
      TemplateStringsArray,
      ...unknown[],
   ];
   return Prisma.sql(strings, ...values);
};

describe("POST /invites validation", () => {
   it("refuses a server listed twice", async () => {
      const res = await send({
         emails: ["one@example.com"],
         targets: [viewerOn(SERVER), viewerOn(SERVER, "beta")],
      });
      expect(res.status).toBe(400);
      expect((await res.json()).message).toContain(
         "Each server can only be listed once"
      );
      expect(state.lockRaw).not.toHaveBeenCalled();
   });

   it("refuses an empty target list and an admin limited to folders", async () => {
      expect(
         (await send({ emails: ["one@example.com"], targets: [] })).status
      ).toBe(400);
      expect(
         (
            await send({
               emails: ["one@example.com"],
               targets: [
                  {
                     serverId: SERVER,
                     role: "ADMIN",
                     bucketAccess: [
                        { bucketName: "alpha", role: "ADMIN", folders: ["a/"] },
                     ],
                  },
               ],
            })
         ).status
      ).toBe(400);
   });

   it("saves without emailing anyone when asked not to notify", async () => {
      const result = await outcome({
         emails: ["one@example.com"],
         targets: [viewerOn(SERVER)],
         notify: false,
      });
      expect(on(SERVER).written).toHaveLength(1);
      expect(result.invites[0]?.emailed).toBe(false);
      expect(state.sendEmail).not.toHaveBeenCalled();
      expect(state.recordManyFor).toHaveBeenCalledOnce();
   });

   it("invites a repeated address once", async () => {
      const result = await outcome({
         emails: ["One@example.com", "one@example.com "],
         targets: [viewerOn(SERVER)],
      });
      expect(result.invites.map(({ email }) => email)).toEqual([
         "one@example.com",
      ]);
      expect(on(SERVER).written).toHaveLength(1);
      expect(state.sendEmail).toHaveBeenCalledOnce();
   });
});

describe("POST /invites on one server", () => {
   it("refuses replacing lower-role invites carrying protected bucket grants", async () => {
      on(SERVER).role = "ADMIN";
      on(SERVER).pending = [{ email: "one@example.com", role: "VIEWER" }];
      state.grantRows = [
         {
            invitationId: inviteId(SERVER, "one@example.com"),
            ...grant("photos", "ADMIN"),
         },
      ];
      const result = await outcome({
         emails: ["one@example.com"],
         targets: [viewerOn(SERVER, "photos")],
      });
      expect(result).toEqual({
         serverId: SERVER,
         invites: [],
         alreadyMembers: [],
         error: "one@example.com already has a pending invite with access you can't replace",
      });
      expect(on(SERVER).written).toEqual([]);
      expect(state.deleteGrants).not.toHaveBeenCalled();
      expect(state.deleteInvites).not.toHaveBeenCalled();
      expect(state.sendEmail).not.toHaveBeenCalled();
      expect(state.writeAudit).toHaveBeenCalledWith(
         expect.objectContaining({
            serverId: SERVER,
            actor: { id: ACTOR, email: "actor@example.com" },
            audit: { enabled: true, level: "ALL" },
            entry: expect.objectContaining({
               action: "access.denied",
               detail: { permission: "MANAGE_MEMBERS", reason: "member" },
            }),
         })
      );
   });

   it("refuses an admin replacing an invite with a grant on a bucket the admin doesn't hold", async () => {
      on(SERVER).role = "ADMIN";
      on(SERVER).pending = [{ email: "one@example.com", role: "EDITOR" }];
      state.grantRows = [
         {
            invitationId: inviteId(SERVER, "one@example.com"),
            ...grant("finance", "EDITOR"),
         },
      ];
      const result = await outcome({
         emails: ["one@example.com"],
         targets: [viewerOn(SERVER, "photos")],
      });
      expect(result.error).toMatch(/can't replace/);
      expect(on(SERVER).written).toEqual([]);
      expect(state.deleteGrants).not.toHaveBeenCalled();
   });

   it("lets an admin replace an invite whose grants the admin could hand out", async () => {
      on(SERVER).role = "ADMIN";
      state.held.set("finance", { role: "EDITOR", folders: null });
      on(SERVER).pending = [{ email: "one@example.com", role: "EDITOR" }];
      state.grantRows = [
         {
            invitationId: inviteId(SERVER, "one@example.com"),
            ...grant("finance", "EDITOR"),
         },
      ];
      const result = await outcome({
         emails: ["one@example.com"],
         targets: [viewerOn(SERVER, "photos")],
      });
      expect(result.error).toBeNull();
      expect(state.deleteGrants).toHaveBeenCalledOnce();
   });

   it("allows an owner to replace the protected invitation", async () => {
      on(SERVER).pending = [{ email: "one@example.com", role: "VIEWER" }];
      state.grantRows = [
         {
            invitationId: inviteId(SERVER, "one@example.com"),
            ...grant("photos", "ADMIN"),
         },
      ];
      const result = await outcome({
         emails: ["one@example.com"],
         targets: [viewerOn(SERVER, "photos")],
      });
      expect(result.error).toBeNull();
      expect(state.deleteGrants).toHaveBeenCalledOnce();
      expect(on(SERVER).written).toHaveLength(1);
   });

   it("records one row per invite it creates, with the role and grants", async () => {
      await sent({
         emails: ["one@example.com", "two@example.com"],
         targets: [
            {
               serverId: SERVER,
               role: "EDITOR",
               bucketAccess: [
                  { bucketName: "beta", role: "VIEWER", folders: null },
                  { bucketName: "alpha", role: "EDITOR", folders: null },
               ],
            },
         ],
      });
      expect(state.recordManyFor).toHaveBeenCalledWith(
         expect.objectContaining({ id: ACTOR, email: "actor@example.com" }),
         SERVER,
         { enabled: true, level: "ALL" },
         [
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
         ]
      );
   });

   it("records nothing for an address that is already a member", async () => {
      on(SERVER).members = ["member@example.com"];
      const result = await outcome({
         emails: ["member@example.com"],
         targets: [viewerOn(SERVER)],
      });
      expect(result).toEqual({
         serverId: SERVER,
         invites: [],
         alreadyMembers: ["member@example.com"],
         error: null,
      });
      expect(entriesFor(SERVER)).toEqual([]);
      expect(state.sendEmail).not.toHaveBeenCalled();
   });

   it("takes the invite-send lock rather than the shared single-key one", async () => {
      await sent({ emails: ["one@example.com"], targets: [viewerOn(SERVER)] });
      expect(lockSql().values).toEqual([LOCK_NAMESPACE.INVITE_SEND, SERVER]);
   });

   it("reports a server whose invite lock another send holds", async () => {
      state.busy.add(SERVER);
      const result = await outcome({
         emails: ["one@example.com"],
         targets: [viewerOn(SERVER)],
      });
      expect(result.error).toBe(
         "Another invite is being sent for this server. Try again."
      );
      expect(state.recordManyFor).not.toHaveBeenCalled();
      expect(state.writeAudit).not.toHaveBeenCalled();
   });

   it("records a denial when the actor may not grant that role", async () => {
      on(SERVER).role = "ADMIN";
      const result = await outcome({
         emails: ["one@example.com"],
         targets: [
            {
               serverId: SERVER,
               role: "ADMIN",
               bucketAccess: [
                  { bucketName: "alpha", role: "VIEWER", folders: null },
               ],
            },
         ],
      });
      expect(result.error).toBe("You can't invite with that role");
      expect(state.recordManyFor).not.toHaveBeenCalled();
      expect(denials()).toMatchObject([
         { serverId: SERVER, entry: { action: "access.denied" } },
      ]);
   });

   it("answers a non-member as if the server did not exist", async () => {
      on(SERVER).role = null;
      const result = await outcome({
         emails: ["one@example.com"],
         targets: [viewerOn(SERVER)],
      });
      expect(result.error).toBe(SERVER_NOT_FOUND);
      expect(state.writeAudit).not.toHaveBeenCalled();
   });

   it("refuses an admin granting a role above the one held and saves nothing", async () => {
      on(SERVER).role = "ADMIN";
      state.held.set("photos", { role: "VIEWER", folders: null });
      const result = await outcome({
         emails: ["one@example.com"],
         targets: [
            {
               serverId: SERVER,
               role: "EDITOR",
               bucketAccess: [
                  { bucketName: "photos", role: "EDITOR", folders: null },
               ],
            },
         ],
      });
      expect(result.error).toBe(
         "You don't have Editor access to photos, so you can't grant it"
      );
      expect(on(SERVER).written).toEqual([]);
      expect(state.recordManyFor).not.toHaveBeenCalled();
      expect(denials()).toMatchObject([
         { serverId: SERVER, entry: { action: "access.denied" } },
      ]);
   });

   it("records a denial for an EDITOR who cannot manage members", async () => {
      on(SERVER).role = "EDITOR";
      const result = await outcome({
         emails: ["one@example.com"],
         targets: [viewerOn(SERVER)],
      });
      expect(result.error).toBe("You don't have permission to do that");
      expect(denials()).toMatchObject([
         {
            serverId: SERVER,
            entry: {
               action: "access.denied",
               detail: { permission: "MANAGE_MEMBERS", reason: "forbidden" },
            },
         },
      ]);
   });

   it("reports a server that does not exist", async () => {
      const result = await outcome(
         { emails: ["one@example.com"], targets: [viewerOn("missing12345")] },
         "missing12345"
      );
      expect(result.error).toBe(SERVER_NOT_FOUND);
      expect(state.writeAudit).not.toHaveBeenCalled();
   });

   it("hides an unexpected failure behind a generic message and logs it", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      state.beforeServerLock.mockRejectedValue(new Error("pool exhausted"));
      const result = await outcome({
         emails: ["one@example.com"],
         targets: [viewerOn(SERVER)],
      });
      expect(result.error).toBe("Something went wrong. Please try again.");
      expect(
         vi
            .mocked(console.error)
            .mock.calls.some(([line]) =>
               String(line).includes("Invite send failed")
            )
      ).toBe(true);
      vi.restoreAllMocks();
   });

   it("enforces the pending cap per server", async () => {
      on(SERVER).pending = Array.from({ length: 30 }, (_unused, index) => ({
         email: `person${index}@example.com`,
         role: "VIEWER",
      }));
      server(OTHER);
      const { outcomes } = await sent({
         emails: ["one@example.com"],
         targets: [viewerOn(SERVER), viewerOn(OTHER)],
      });
      expect(outcomes[0]?.error).toMatch(
         /already has 30 pending invites, and can have at most 30/
      );
      expect(outcomes[1]).toMatchObject({
         serverId: OTHER,
         invites: [{ email: "one@example.com", emailed: true }],
         error: null,
      });
      expect(messages()).toHaveLength(1);
      expect(messages()[0]?.servers).toEqual([
         { serverName: `Server ${OTHER}`, role: "VIEWER" },
      ]);
   });

   it("emails each new invite its own random token and keeps it out of the response and the audit rows", async () => {
      const res = await send({
         emails: ["one@example.com", "two@example.com"],
         targets: [viewerOn(SERVER)],
      });
      expect(res.status).toBe(200);
      const body = await res.text();
      const emails = ["one@example.com", "two@example.com"];
      const tokens = emails.map(
         (email) => state.tokens.get(tokenKey(SERVER, email)) ?? ""
      );
      expect(new Set(tokens).size).toBe(2);
      for (const [index, email] of emails.entries()) {
         const token = tokens[index] ?? "";
         expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
         expect(linkFor(email).searchParams.get("invite")).toBe(token);
         expect(linkFor(email).pathname).toBe("/settings/invites");
         expect(body).not.toContain(token);
         expect(JSON.stringify(entriesFor(SERVER))).not.toContain(token);
      }
      expect(JSON.parse(body).outcomes[0].invites[0]).not.toHaveProperty(
         "token"
      );
   });

   const resend = () =>
      outcome({
         emails: ["one@example.com"],
         targets: [
            {
               serverId: SERVER,
               role: "EDITOR",
               bucketAccess: [
                  { bucketName: "alpha", role: "VIEWER", folders: null },
               ],
            },
         ],
      });

   it("mails a re-sent invite a fresh token in place of the one it had", async () => {
      on(SERVER).pending = [
         { email: "one@example.com", role: "VIEWER", token: "kept-token-1" },
      ];
      expect((await resend()).error).toBeNull();
      const rotated =
         state.tokens.get(tokenKey(SERVER, "one@example.com")) ?? "";
      expect(rotated).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(linkFor("one@example.com").searchParams.get("invite")).toBe(
         rotated
      );
   });

   it("keeps a re-sent invite's token when no email goes out", async () => {
      on(SERVER).pending = [
         { email: "one@example.com", role: "VIEWER", token: "kept-token-1" },
      ];
      state.reserve = async () => null;
      const result = await resend();
      expect(result.invites[0]?.emailed).toBe(false);
      expect(state.tokens.size).toBe(0);
      expect(state.sendEmail).not.toHaveBeenCalled();
   });

   it("restores a re-sent invite's token when its email fails", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      on(SERVER).pending = [
         { email: "one@example.com", role: "VIEWER", token: "kept-token-1" },
      ];
      state.sendEmail.mockRejectedValue(new Error("Email delivery is busy"));
      expect((await resend()).invites[0]?.emailed).toBe(false);
      expect(tokenOf(SERVER, "one@example.com")).toBe("kept-token-1");
      vi.restoreAllMocks();
   });

   it("mails nothing for an invite whose token changed after the save", async () => {
      on(SERVER).pending = [
         { email: "one@example.com", role: "VIEWER", token: "kept-token-1" },
      ];
      state.reserve = async (servers) => {
         state.tokens.set(
            tokenKey(SERVER, "one@example.com"),
            "someone-else-1"
         );
         return { servers, release: async () => {} };
      };
      const result = await resend();
      expect(result.invites[0]?.emailed).toBe(false);
      expect(state.sendEmail).not.toHaveBeenCalled();
      expect(tokenOf(SERVER, "one@example.com")).toBe("someone-else-1");
   });
});

describe("POST /invites and a stale sign-in", () => {
   const adminOn = (serverId: string) => ({
      serverId,
      role: "ADMIN",
      bucketAccess: [{ bucketName: "alpha", role: "VIEWER", folders: null }],
   });

   beforeEach(() => {
      state.sessionCreatedAt = Date.now() - 25 * 60 * 60 * 1000;
      server(OTHER);
   });

   it("refuses the whole batch when any target invites an admin, before saving any", async () => {
      const res = await send({
         emails: ["one@example.com"],
         targets: [viewerOn(SERVER), adminOn(OTHER)],
      });
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ code: "SESSION_STALE" });
      expect(state.lockRaw).not.toHaveBeenCalled();
      expect(on(SERVER).written).toEqual([]);
      expect(state.sendEmail).not.toHaveBeenCalled();
      expect(state.recordManyFor).not.toHaveBeenCalled();
   });

   it("refuses a viewer invite that makes them a bucket admin", async () => {
      const res = await send({
         emails: ["one@example.com"],
         targets: [
            {
               serverId: SERVER,
               role: "VIEWER",
               bucketAccess: [
                  { bucketName: "alpha", role: "ADMIN", folders: null },
               ],
            },
         ],
      });
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ code: "SESSION_STALE" });
      expect(on(SERVER).written).toEqual([]);
   });

   it("still sends invites below admin", async () => {
      const result = await outcome({
         emails: ["one@example.com"],
         targets: [viewerOn(SERVER)],
      });
      expect(result.error).toBeNull();
      expect(on(SERVER).written).toHaveLength(1);
   });
});

describe("POST /invites across servers", () => {
   beforeEach(() => {
      server(OTHER);
   });

   it("saves on the servers that allow it and reports the one that refused", async () => {
      on(OTHER).role = "ADMIN";
      const { outcomes } = await sent({
         emails: ["one@example.com"],
         targets: [
            {
               serverId: SERVER,
               role: "ADMIN",
               bucketAccess: [
                  { bucketName: "alpha", role: "VIEWER", folders: null },
               ],
            },
            {
               serverId: OTHER,
               role: "ADMIN",
               bucketAccess: [
                  { bucketName: "alpha", role: "VIEWER", folders: null },
               ],
            },
         ],
      });
      expect(outcomes).toMatchObject([
         {
            serverId: SERVER,
            invites: [
               { email: "one@example.com", role: "ADMIN", emailed: true },
            ],
            alreadyMembers: [],
            error: null,
         },
         {
            serverId: OTHER,
            invites: [],
            alreadyMembers: [],
            error: "You can't invite with that role",
         },
      ]);
      expect(on(SERVER).written).toHaveLength(1);
      expect(on(OTHER).written).toEqual([]);
      expect(denials()).toMatchObject([
         { serverId: OTHER, entry: { action: "access.denied" } },
      ]);
      expect(state.recordManyFor).toHaveBeenCalledOnce();
      expect(messages()).toMatchObject([
         {
            to: "one@example.com",
            servers: [{ serverName: "Server", role: "ADMIN" }],
         },
      ]);
   });

   it("sends each recipient one email listing every server that invited them", async () => {
      on(OTHER).members = ["two@example.com"];
      const { outcomes } = await sent({
         emails: ["one@example.com", "two@example.com"],
         targets: [
            viewerOn(SERVER),
            {
               serverId: OTHER,
               role: "EDITOR",
               bucketAccess: [
                  { bucketName: "alpha", role: "EDITOR", folders: null },
               ],
            },
         ],
      });
      expect(
         outcomes.map(({ invites }) => invites.map(({ emailed }) => emailed))
      ).toEqual([[true, true], [true]]);
      expect(outcomes[1]?.alreadyMembers).toEqual(["two@example.com"]);
      expect(messages()).toHaveLength(2);
      expect(messages().find((m) => m.to === "one@example.com")).toMatchObject({
         inviterName: "Actor",
         inviterEmail: "actor@example.com",
         servers: [
            { serverName: "Server", role: "VIEWER" },
            { serverName: `Server ${OTHER}`, role: "EDITOR" },
         ],
      });
      expect(
         messages().find((m) => m.to === "two@example.com")?.servers
      ).toEqual([{ serverName: "Server", role: "VIEWER" }]);
      const link = linkFor("one@example.com").searchParams.get("invite");
      expect([
         tokenOf(SERVER, "one@example.com"),
         tokenOf(OTHER, "one@example.com"),
      ]).toContain(link);
      expect(state.recordManyFor).toHaveBeenCalledTimes(2);
   });

   it("leaves a server in its cooldown out of the email and marks only that invite unsent", async () => {
      await sent({ emails: ["one@example.com"], targets: [viewerOn(SERVER)] });
      on(SERVER).pending = [{ email: "one@example.com", role: "VIEWER" }];
      const { outcomes } = await sent({
         emails: ["one@example.com"],
         targets: [viewerOn(SERVER), viewerOn(OTHER)],
      });
      expect(outcomes.map(({ invites }) => invites[0]?.emailed)).toEqual([
         false,
         true,
      ]);
      expect(messages()).toHaveLength(2);
      expect(messages()[1]?.servers).toEqual([
         { serverName: `Server ${OTHER}`, role: "VIEWER" },
      ]);
   });

   it("prefers a fresh invite's token for the link so a renewed one keeps its own", async () => {
      on(SERVER).pending = [
         { email: "one@example.com", role: "VIEWER", token: "kept-token-1" },
      ];
      const { outcomes } = await sent({
         emails: ["one@example.com"],
         targets: [viewerOn(SERVER), viewerOn(OTHER)],
      });
      expect(outcomes.map(({ invites }) => invites[0]?.emailed)).toEqual([
         true,
         true,
      ]);
      expect(tokenOf(SERVER, "one@example.com")).toBe("kept-token-1");
      expect(linkFor("one@example.com").searchParams.get("invite")).toBe(
         tokenOf(OTHER, "one@example.com")
      );
   });

   it("marks every listed invite unsent when the one email fails", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      state.sendEmail.mockRejectedValue(new Error("Email delivery is busy"));
      const { outcomes } = await sent({
         emails: ["one@example.com"],
         targets: [viewerOn(SERVER), viewerOn(OTHER)],
      });
      expect(outcomes.map(({ invites }) => invites[0]?.emailed)).toEqual([
         false,
         false,
      ]);
      state.sendEmail.mockResolvedValue(undefined);
      on(SERVER).pending = [{ email: "one@example.com", role: "VIEWER" }];
      const retried = await outcome({
         emails: ["one@example.com"],
         targets: [viewerOn(SERVER)],
      });
      expect(retried.invites[0]?.emailed).toBe(true);
      vi.restoreAllMocks();
   });
});

describe("invite emails", () => {
   const inviteOn = (emails: string[]) =>
      outcome({ emails, targets: [viewerOn(SERVER)] });

   beforeEach(() => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
   });

   afterEach(() => {
      vi.restoreAllMocks();
   });

   it("marks each invite as emailed and names the inviter's address", async () => {
      const body = await inviteOn(["one@example.com", "two@example.com"]);
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
            expiresAt: expect.any(Date),
         })
      );
   });

   it("saves a repeat invite inside the cooldown without emailing again", async () => {
      await inviteOn(["one@example.com"]);
      on(SERVER).pending = [{ email: "one@example.com", role: "VIEWER" }];
      const again = await inviteOn(["one@example.com"]);
      expect(state.sendEmail).toHaveBeenCalledOnce();
      expect(again.invites).toMatchObject([
         { email: "one@example.com", emailed: false },
      ]);
      expect(on(SERVER).written.map(({ email }) => email)).toEqual([
         "one@example.com",
         "one@example.com",
      ]);
   });

   it("reports and logs a failed send instead of claiming it went out", async () => {
      state.sendEmail.mockImplementation(async ({ to }: { to: string }) => {
         if (to === "one@example.com")
            throw new Error("Email delivery is busy");
      });
      const body = await inviteOn(["one@example.com", "two@example.com"]);
      expect(body.invites.map(({ emailed }) => emailed)).toEqual([false, true]);
      expect(
         vi
            .mocked(console.error)
            .mock.calls.some(([line]) =>
               String(line).includes("Invite email failed")
            )
      ).toBe(true);
      state.sendEmail.mockResolvedValue(undefined);
      const retried = await inviteOn(["one@example.com"]);
      expect(retried.invites[0]?.emailed).toBe(true);
   });
});

describe("invitation authority while waiting for the server lock", () => {
   it.each(["protected grant added", "actor demoted", "membership removed"])(
      "rechecks a replace after %s",
      async (change) => {
         on(SERVER).role = "ADMIN";
         on(SERVER).pending = [{ email: "one@example.com", role: "VIEWER" }];
         let reachedLock!: () => void;
         let resume!: () => void;
         const waiting = new Promise<void>((resolve) => {
            reachedLock = resolve;
         });
         const held = new Promise<void>((resolve) => {
            resume = resolve;
         });
         state.beforeServerLock.mockImplementationOnce(async () => {
            reachedLock();
            await held;
         });
         const response = outcome({
            emails: ["one@example.com"],
            targets: [viewerOn(SERVER, "photos")],
         });
         await waiting;
         if (change === "protected grant added") {
            state.grantRows = [
               {
                  invitationId: inviteId(SERVER, "one@example.com"),
                  ...grant("photos", "ADMIN"),
               },
            ];
         }
         if (change === "actor demoted") on(SERVER).role = "EDITOR";
         if (change === "membership removed") on(SERVER).role = null;
         resume();
         expect((await response).error).not.toBeNull();
         expect(on(SERVER).written).toEqual([]);
         expect(state.deleteInvites).not.toHaveBeenCalled();
         expect(state.deleteGrants).not.toHaveBeenCalled();
         // a removed member is answered as a stranger, so no denial is logged for them
         expect(state.writeAudit).toHaveBeenCalledTimes(
            change === "membership removed" ? 0 : 1
         );
      }
   );
});
