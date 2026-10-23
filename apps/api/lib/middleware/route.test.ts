import express from "express";
import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";
import { Permission } from "@s3-viewer/permissions";
import {
   AuditLevel,
   MINUTE_MS,
   Role,
   bucketScope,
   serverScope,
   updateRoleSchema,
} from "@s3-viewer/types";
import { z } from "zod";
import { errorHandler } from "@/lib/http";
import {
   routeServer,
   scopeQueryRaw,
   signedIn,
} from "@/lib/testing/route-harness";
import type { DbRole } from "@/lib/testing/scope-probe";

const ACTOR = "actor12345";
const TARGET = "target1234";

const state = vi.hoisted(() => ({
   role: "VIEWER" as DbRole | null,
   targetRole: "EDITOR" as DbRole,
   grant: "VIEWER" as DbRole | null,
   folders: undefined as string[] | undefined,
   allowed: ["photos"],
   level: "ALL" as "ALL" | "CHANGES",
   writeAudit: vi.fn(),
   handler: vi.fn(),
}));

vi.mock("@/lib/audit/writer", async (importOriginal) => ({
   ...(await importOriginal<typeof import("@/lib/audit/writer")>()),
   writeAudit: state.writeAudit,
}));

type AccessArgs = { where: { userId_serverId: { userId: string } } };

vi.mock("@s3-viewer/db", () => ({
   prisma: {
      serverAccess: {
         findUnique: async ({ where }: AccessArgs) =>
            where.userId_serverId.userId === TARGET
               ? { role: state.targetRole }
               : null,
      },
      $queryRaw: scopeQueryRaw(({ userId }) =>
         userId === ACTOR && state.role
            ? {
                 role: state.role,
                 auditEnabled: true,
                 auditLevel: state.level,
                 allowedBuckets: state.allowed,
                 restrictedBuckets: true,
                 grants: state.grant
                    ? state.allowed.map((bucketName) => ({
                         bucketName,
                         role: state.grant as DbRole,
                         folders: state.folders,
                      }))
                    : [],
                 auditViewRole: "ADMIN",
                 auditManageRole: "ADMIN",
                 auditRetentionDays: 0,
              }
            : null
      ),
   },
}));

const { AccessDeniedError, assertMemberAuthority, getAuth } = await import(
   "./authorize"
);
const {
   auditRoute,
   bucketRoute,
   memberRoute,
   recordDenials,
   serverRoute,
   wholeBucket,
} = await import("./route");

let base: string;
let clock = new Date("2026-09-07T12:00:00.000Z").getTime();

const later = () => {
   clock += 6 * MINUTE_MS;
   vi.setSystemTime(clock);
};

beforeAll(() => {
   vi.useFakeTimers({ toFake: ["Date"] });
});

routeServer(
   (app) => {
      app.use(express.json());
      app.use(signedIn(() => ({ id: ACTOR })));
      const ok = async (_req: express.Request, res: express.Response) => {
         state.handler();
         res.status(204).end();
      };
      app.delete(
         "/servers/:serverId",
         ...serverRoute(Permission.DELETE_SERVER, serverScope, ok)
      );
      app.delete(
         "/servers/:serverId/buckets/:bucketName",
         ...bucketRoute(Permission.DELETE_BUCKET, bucketScope, wholeBucket, ok)
      );
      app.post(
         "/servers/:serverId/buckets/:bucketName/confirmed",
         ...bucketRoute(
            Permission.DELETE_BUCKET,
            bucketScope.extend({ expectedUserId: z.string() }),
            wholeBucket,
            ok
         )
      );
      const manageMember = async (
         _req: express.Request,
         res: express.Response,
         { role }: { role: keyof typeof Role }
      ) => {
         state.handler();
         assertMemberAuthority(res, {
            serverRole: getAuth(res).serverRole,
            targetRole: Role[state.targetRole],
            newRole: Role[role],
         });
         return ok(_req, res);
      };
      app.patch(
         "/servers/:serverId/members/:userId",
         ...memberRoute(updateRoleSchema, manageMember)
      );
      app.get(
         "/servers/:serverId/audit",
         ...auditRoute("view", serverScope, ok)
      );
      app.get("/servers/:serverId/elsewhere", (_req, _res, next) =>
         next(
            new AccessDeniedError(403, "Not on that server", {
               serverId: "server67890",
               actorId: ACTOR,
               audit: { enabled: true, level: AuditLevel.ALL },
               entry: {
                  action: "access.denied",
                  bucket: null,
                  detail: { permission: "MANAGE_MEMBERS", reason: "forbidden" },
               },
            })
         )
      );
      app.use(recordDenials);
      app.use(errorHandler);
   },
   (origin) => {
      base = `${origin}/servers/server12345`;
   }
);

afterAll(() => {
   vi.useRealTimers();
});

beforeEach(() => {
   later();
   state.role = "VIEWER";
   state.targetRole = "EDITOR";
   state.grant = "VIEWER";
   state.folders = undefined;
   state.allowed = ["photos"];
   state.level = "ALL";
   state.writeAudit.mockReset().mockResolvedValue(undefined);
   state.handler.mockReset();
});

const call = (
   path: string,
   method: string,
   body?: unknown,
   origin: Record<string, string> = { "sec-fetch-site": "same-origin" }
) =>
   fetch(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json", ...origin },
      body: body === undefined ? undefined : JSON.stringify(body),
   });

const denied = (
   permission: string,
   reason: string,
   bucket: string | null = null
) => ({
   serverId: "server12345",
   actor: { id: ACTOR, email: "actor@example.com" },
   audit: { enabled: true, level: "ALL" },
   entry: { action: "access.denied", bucket, detail: { permission, reason } },
});

describe("refused attempts", () => {
   it("records a server-scope refusal and answers the member as before", async () => {
      const res = await call("", "DELETE");
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({
         message: "You don't have permission to do that",
      });
      expect(state.writeAudit).toHaveBeenCalledWith(
         denied("DELETE_SERVER", "forbidden")
      );
      expect(state.handler).not.toHaveBeenCalled();
   });

   it("records a bucket the member may not see, and a bucket permission they lack", async () => {
      state.role = "ADMIN";
      const hidden = await call("/buckets/secret", "DELETE");
      expect(hidden.status).toBe(404);
      expect(await hidden.json()).toEqual({ message: "Bucket not found" });
      expect(state.writeAudit).toHaveBeenLastCalledWith(
         denied("DELETE_BUCKET", "bucket")
      );

      later();
      state.level = "CHANGES";
      expect((await call("/buckets/photos", "DELETE")).status).toBe(403);
      expect(state.writeAudit).toHaveBeenLastCalledWith({
         ...denied("DELETE_BUCKET", "forbidden", "photos"),
         audit: { enabled: true, level: "CHANGES" },
      });
      expect(state.writeAudit).toHaveBeenCalledTimes(2);
   });

   it("records every way a member action can be refused", async () => {
      expect(
         (await call(`/members/${TARGET}`, "PATCH", { role: "VIEWER" })).status
      ).toBe(403);
      expect(state.handler).not.toHaveBeenCalled();
      expect(state.writeAudit).toHaveBeenLastCalledWith(
         denied("MANAGE_MEMBERS", "forbidden")
      );

      later();
      state.role = "ADMIN";
      state.targetRole = "ADMIN";
      const peer = await call(`/members/${TARGET}`, "PATCH", {
         role: "VIEWER",
      });
      expect(peer.status).toBe(403);
      expect(await peer.json()).toEqual({
         message: "You can't manage that member",
      });
      expect(state.writeAudit).toHaveBeenLastCalledWith(
         denied("MANAGE_MEMBERS", "member")
      );

      later();
      state.targetRole = "EDITOR";
      const promote = await call(`/members/${TARGET}`, "PATCH", {
         role: "ADMIN",
      });
      expect(promote.status).toBe(403);
      expect(await promote.json()).toEqual({
         message: "You can't assign that role",
      });
      expect(state.writeAudit).toHaveBeenLastCalledWith(
         denied("MANAGE_MEMBERS", "member")
      );
      expect(state.writeAudit).toHaveBeenCalledTimes(3);
      expect(state.handler).toHaveBeenCalledTimes(2);
   });

   it("records a refused audit read", async () => {
      expect((await call("/audit", "GET")).status).toBe(403);
      expect(state.writeAudit).toHaveBeenCalledWith(
         denied("audit.view", "audit")
      );
   });

   it.each([
      ["no origin proof", {}],
      ["a sibling-site navigation", { "sec-fetch-site": "same-site" }],
      ["another site's Origin", { origin: "https://evil.example" }],
   ])("flags a refused read that arrives with %s", async (_name, origin) => {
      expect((await call("/audit", "GET", undefined, origin)).status).toBe(403);
      const flagged = denied("audit.view", "audit");
      expect(state.writeAudit).toHaveBeenCalledExactlyOnceWith({
         ...flagged,
         entry: {
            ...flagged.entry,
            detail: { ...flagged.entry.detail, unverifiedOrigin: true },
         },
      });
   });

   it("leaves a refused read from the app's own origin unflagged", async () => {
      const res = await call("/audit", "GET", undefined, {
         origin: "http://localhost:3000",
      });
      expect(res.status).toBe(403);
      expect(state.writeAudit).toHaveBeenCalledExactlyOnceWith(
         denied("audit.view", "audit")
      );
   });

   it("does not let a flagged refusal stand in for a verified one", async () => {
      expect((await call("/audit", "GET", undefined, {})).status).toBe(403);
      expect((await call("/audit", "GET", undefined, {})).status).toBe(403);
      expect(state.writeAudit).toHaveBeenCalledTimes(1);
      expect((await call("/audit", "GET")).status).toBe(403);
      expect((await call("/audit", "GET")).status).toBe(403);
      expect(state.writeAudit).toHaveBeenCalledTimes(2);
      expect(state.writeAudit).toHaveBeenLastCalledWith(
         denied("audit.view", "audit")
      );
   });

   it("never flags a refused write, which the origin check already vetted", async () => {
      expect((await call("", "DELETE", undefined, {})).status).toBe(403);
      expect(state.writeAudit).toHaveBeenCalledExactlyOnceWith(
         denied("DELETE_SERVER", "forbidden")
      );
   });

   it("records the same refusal once per five minutes, whichever unheld bucket it names", async () => {
      expect((await call("", "DELETE")).status).toBe(403);
      expect((await call("", "DELETE")).status).toBe(403);
      expect(state.writeAudit).toHaveBeenCalledTimes(1);

      state.role = "ADMIN";
      expect((await call("/buckets/secret", "DELETE")).status).toBe(404);
      expect((await call("/buckets/other", "DELETE")).status).toBe(404);
      expect((await call(`/buckets/${"c".repeat(63)}`, "DELETE")).status).toBe(
         404
      );
      expect(state.writeAudit).toHaveBeenCalledTimes(2);
      expect(state.writeAudit).toHaveBeenLastCalledWith(
         denied("DELETE_BUCKET", "bucket")
      );

      later();
      state.role = "VIEWER";
      expect((await call("", "DELETE")).status).toBe(403);
      expect(state.writeAudit).toHaveBeenCalledTimes(3);
   });

   it("does not let a guessed bucket stand in for a folder probe on a held one", async () => {
      state.role = "ADMIN";
      state.grant = "ADMIN";
      state.folders = ["docs/"];
      expect((await call("/buckets/guessed", "DELETE")).status).toBe(404);
      expect((await call("/buckets/photos", "DELETE")).status).toBe(403);
      expect(state.writeAudit).toHaveBeenCalledTimes(2);
      expect(state.writeAudit).toHaveBeenLastCalledWith(
         expect.objectContaining({
            entry: expect.objectContaining({
               bucket: "photos",
               detail: { permission: "DELETE_BUCKET", reason: "folder" },
            }),
         })
      );
   });

   it("still answers the member when the record cannot be written", async () => {
      state.writeAudit.mockRejectedValue(new Error("database went away"));
      const res = await call("", "DELETE");
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({
         message: "You don't have permission to do that",
      });
   });

   it("records on the server that refused, not the one in the route", async () => {
      const res = await call("/elsewhere", "GET");
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ message: "Not on that server" });
      expect(state.writeAudit).toHaveBeenCalledWith({
         ...denied("MANAGE_MEMBERS", "forbidden"),
         serverId: "server67890",
      });
   });

   it("records nothing for a non-member or a permitted request", async () => {
      state.role = null;
      expect((await call("", "DELETE")).status).toBe(404);
      expect((await call("/buckets/photos", "DELETE")).status).toBe(404);
      expect(
         (await call(`/members/${TARGET}`, "PATCH", { role: "VIEWER" })).status
      ).toBe(404);
      expect((await call("/audit", "GET")).status).toBe(404);

      state.role = "OWNER";
      expect((await call("", "DELETE")).status).toBe(204);
      expect((await call("/buckets/photos", "DELETE")).status).toBe(204);
      expect((await call("/audit", "GET")).status).toBe(204);
      expect(state.handler).toHaveBeenCalledTimes(3);
      expect(state.writeAudit).not.toHaveBeenCalled();
   });
});

describe("bucket routes bound to the signed-in account", () => {
   it("refuses a request initiated by another account before its handler runs", async () => {
      state.role = "OWNER";
      const path = "/buckets/photos/confirmed";
      const refused = await call(path, "POST", { expectedUserId: TARGET });
      expect(refused.status).toBe(403);
      expect(state.handler).not.toHaveBeenCalled();
      expect((await call(path, "POST", { expectedUserId: ACTOR })).status).toBe(
         204
      );
   });
});
