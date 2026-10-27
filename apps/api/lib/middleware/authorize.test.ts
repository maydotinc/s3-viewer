import { Prisma } from "@prisma/client";
import { Permission } from "@s3-viewer/permissions";
import { AuditLevel, Role } from "@s3-viewer/shared";
import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { scopeQueryRaw } from "@/lib/testing/route-harness";

type AccessRow = { userId: string; serverId: string; role: keyof typeof Role };
type GrantRow = AccessRow & { bucketName: string };
type ServerRow = {
   id: string;
   auditEnabled: boolean;
   auditLevel: keyof typeof AuditLevel;
   allowedBuckets: string[];
   restrictedBuckets: boolean;
   auditViewRole: keyof typeof Role;
   auditManageRole: keyof typeof Role;
   auditRetentionDays: number;
};

const db: { access: AccessRow[]; grants: GrantRow[]; servers: ServerRow[] } = {
   access: [],
   grants: [],
   servers: [],
};

const probe = scopeQueryRaw(({ userId, serverId }) => {
   const access = db.access.find(
      (row) => row.userId === userId && row.serverId === serverId
   );
   const server = access && db.servers.find((row) => row.id === serverId);
   if (!access || !server) return null;
   return {
      ...server,
      role: access.role,
      credentials: `sealed:${server.id}`,
      provider: "S3",
      ownerId: "owner1",
      grants: db.grants.filter(
         (row) => row.userId === userId && row.serverId === serverId
      ),
   };
});

const queryRaw = vi.fn(
   async (strings: TemplateStringsArray, ...raw: unknown[]) => {
      const { text } = Prisma.sql(strings, ...raw);
      expect(text).not.toMatch(/'/);
      expect(text).toContain('s."allowedBuckets"');
      expect(text).toContain('s."restrictedBuckets"');
      return probe(strings, ...raw);
   }
);

vi.mock("@s3-viewer/db", () => ({ prisma: { $queryRaw: queryRaw } }));

const { authorizeAudit, authorizeBucket, authorizeServer } = await import(
   "./authorize"
);

const SERVER: ServerRow = {
   id: "server1",
   auditEnabled: true,
   auditLevel: "ALL",
   allowedBuckets: ["allowed-bucket", "other-bucket"],
   restrictedBuckets: true,
   auditViewRole: "ADMIN",
   auditManageRole: "OWNER",
   auditRetentionDays: 30,
};

const member = (role: keyof typeof Role): AccessRow => ({
   userId: "user1",
   serverId: "server1",
   role,
});

const grant = (bucketName: string, role: keyof typeof Role): GrantRow => ({
   ...member(role),
   bucketName,
});

beforeEach(() => {
   queryRaw.mockClear();
   db.servers = [{ ...SERVER }];
   db.access = [];
   db.grants = [];
});

const statements = () => queryRaw.mock.calls.length;

const thrown = async (call: Promise<unknown>) =>
   await call.then(
      () => {
         throw new Error("expected a rejection");
      },
      (error: unknown) =>
         error as { status: number; message: string } & Record<string, unknown>
   );

describe("authorizeBucket", () => {
   it("reads server, scope and grant in a single statement", async () => {
      db.access = [member("OWNER")];
      await authorizeBucket(
         "user1",
         "server1",
         "allowed-bucket",
         Permission.LIST_OBJECTS
      );
      expect(statements()).toBe(1);
   });

   it("404s a user with no membership row", async () => {
      db.grants = [grant("allowed-bucket", "ADMIN")];
      const error = await thrown(
         authorizeBucket(
            "user1",
            "server1",
            "allowed-bucket",
            Permission.LIST_OBJECTS
         )
      );
      expect(error.status).toBe(404);
      expect(error.name).not.toBe("AccessDeniedError");
   });

   it("404s a bucket outside the server's scope, as 'bucket', not 403", async () => {
      db.access = [member("OWNER")];
      const error = await thrown(
         authorizeBucket(
            "user1",
            "server1",
            "unlisted-bucket",
            Permission.LIST_OBJECTS
         )
      );
      expect(error.status).toBe(404);
      expect(error.message).toBe("Bucket not found");
      expect(error.denial).toMatchObject({
         serverId: "server1",
         actorId: "user1",
         audit: { enabled: true, level: AuditLevel.ALL },
         entry: {
            action: "access.denied",
            bucket: null,
            detail: { permission: Permission.LIST_OBJECTS, reason: "bucket" },
         },
      });
   });

   it("keeps an unrestricted server open to any bucket", async () => {
      db.servers = [
         { ...SERVER, restrictedBuckets: false, allowedBuckets: [] },
      ];
      db.access = [member("OWNER")];
      const auth = await authorizeBucket(
         "user1",
         "server1",
         "anything-at-all",
         Permission.LIST_OBJECTS
      );
      expect(auth.bucketRole).toBe(Role.OWNER);
   });

   it("answers a roleless member the same 404 whether or not the bucket is listed", async () => {
      db.access = [member("ADMIN")];
      const attempt = async (bucketName: string) => {
         const error = await thrown(
            authorizeBucket(
               "user1",
               "server1",
               bucketName,
               Permission.LIST_OBJECTS
            )
         );
         const { entry } = error.denial as {
            entry: { bucket: string | null; detail: { reason: string } };
         };
         return {
            status: error.status,
            message: error.message,
            reason: entry.detail.reason,
            bucket: entry.bucket,
         };
      };
      const listed = await attempt("allowed-bucket");
      expect(listed).toEqual({
         status: 404,
         message: "Bucket not found",
         reason: "bucket",
         bucket: "allowed-bucket",
      });
      expect(await attempt("unlisted-bucket")).toEqual({
         ...listed,
         bucket: null,
      });
   });

   it("never records a caller-typed name on an unrestricted server", async () => {
      db.servers = [
         { ...SERVER, restrictedBuckets: false, allowedBuckets: ["typed"] },
      ];
      db.access = [member("VIEWER")];
      const error = await thrown(
         authorizeBucket("user1", "server1", "typed", Permission.LIST_OBJECTS)
      );
      expect(error.status).toBe(404);
      expect(error.denial).toMatchObject({ entry: { bucket: null } });
   });

   it("403s a member whose role on a listed bucket lacks the permission", async () => {
      db.access = [member("ADMIN")];
      db.grants = [grant("allowed-bucket", "VIEWER")];
      const error = await thrown(
         authorizeBucket(
            "user1",
            "server1",
            "allowed-bucket",
            Permission.UPLOAD_OBJECT
         )
      );
      expect(error.status).toBe(403);
      expect(error.denial).toMatchObject({
         entry: {
            bucket: "allowed-bucket",
            detail: {
               permission: Permission.UPLOAD_OBJECT,
               reason: "forbidden",
            },
         },
      });
   });

   it("still 404s a stale grant on a bucket that left the allow-list", async () => {
      db.access = [member("ADMIN")];
      db.grants = [grant("unlisted-bucket", "ADMIN")];
      const error = await thrown(
         authorizeBucket(
            "user1",
            "server1",
            "unlisted-bucket",
            Permission.LIST_OBJECTS
         )
      );
      expect(error.status).toBe(404);
      expect(error.denial).toMatchObject({
         entry: { bucket: "unlisted-bucket", detail: { reason: "bucket" } },
      });
   });

   it("admits a non-owner with the role their grant carries", async () => {
      db.access = [member("ADMIN")];
      db.grants = [grant("allowed-bucket", "VIEWER")];
      const auth = await authorizeBucket(
         "user1",
         "server1",
         "allowed-bucket",
         Permission.DOWNLOAD_OBJECT
      );
      expect(auth).toEqual({
         userId: "user1",
         serverId: "server1",
         serverRole: Role.ADMIN,
         bucketRole: Role.VIEWER,
         folders: null,
         audit: { enabled: true, level: AuditLevel.ALL },
         bucketScope: {
            allowedBuckets: SERVER.allowedBuckets,
            restrictedBuckets: true,
         },
         credentials: {
            credentials: "sealed:server1",
            provider: "S3",
            ownerId: "owner1",
         },
      });
   });

   it("gives an owner OWNER on any allowed bucket, grant or not", async () => {
      db.access = [member("OWNER")];
      const auth = await authorizeBucket(
         "user1",
         "server1",
         "other-bucket",
         Permission.DELETE_OBJECT
      );
      expect(auth.bucketRole).toBe(Role.OWNER);
      expect(auth.serverRole).toBe(Role.OWNER);
   });

   it("does not pick up a grant on a DIFFERENT bucket", async () => {
      db.access = [member("VIEWER")];
      db.grants = [grant("other-bucket", "OWNER")];
      const error = await thrown(
         authorizeBucket(
            "user1",
            "server1",
            "allowed-bucket",
            Permission.LIST_OBJECTS
         )
      );
      expect(error.status).toBe(404);
   });

   it("does not pick up another member's grant on the same bucket", async () => {
      db.access = [member("VIEWER")];
      db.grants = [
         { ...grant("allowed-bucket", "OWNER"), userId: "someone-else" },
      ];
      const error = await thrown(
         authorizeBucket(
            "user1",
            "server1",
            "allowed-bucket",
            Permission.LIST_OBJECTS
         )
      );
      expect(error.status).toBe(404);
   });

   it("runs on the transaction client it is handed", async () => {
      db.access = [member("OWNER")];
      const tx = { $queryRaw: vi.fn(queryRaw) };
      await authorizeBucket(
         "user1",
         "server1",
         "allowed-bucket",
         Permission.LIST_OBJECTS,
         tx as never
      );
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(statements()).toBe(1);
   });
});

describe("authorizeServer", () => {
   it("resolves role and audit scope in a single statement", async () => {
      db.access = [member("ADMIN")];
      const auth = await authorizeServer(
         "user1",
         "server1",
         Permission.MANAGE_MEMBERS
      );
      expect(auth).toEqual({
         userId: "user1",
         serverId: "server1",
         serverRole: Role.ADMIN,
         bucketRole: null,
         folders: null,
         audit: { enabled: true, level: AuditLevel.ALL },
         bucketScope: {
            allowedBuckets: SERVER.allowedBuckets,
            restrictedBuckets: true,
         },
         credentials: {
            credentials: "sealed:server1",
            provider: "S3",
            ownerId: "owner1",
         },
      });
      expect(statements()).toBe(1);
   });

   it("skips the credential columns when the route never reaches storage", async () => {
      db.access = [member("ADMIN")];
      const auth = await authorizeServer(
         "user1",
         "server1",
         Permission.MANAGE_MEMBERS,
         false
      );
      const [strings, ...values] = queryRaw.mock.calls[0] as [
         TemplateStringsArray,
         ...unknown[],
      ];
      const { text } = Prisma.sql(strings, ...values);
      expect(text).not.toContain('s."credentials"');
      expect(text).not.toContain('s."ownerId"');
      expect(auth.credentials).toBeUndefined();
      expect(auth.serverRole).toBe(Role.ADMIN);
   });

   it("404s a user with no membership row", async () => {
      const error = await thrown(
         authorizeServer("user1", "server1", Permission.LIST_BUCKETS)
      );
      expect(error.status).toBe(404);
   });

   it("403s a member whose role lacks the permission", async () => {
      db.access = [member("VIEWER")];
      const error = await thrown(
         authorizeServer("user1", "server1", Permission.DELETE_SERVER)
      );
      expect(error.status).toBe(403);
      expect(error.denial).toMatchObject({
         entry: {
            bucket: null,
            detail: {
               permission: Permission.DELETE_SERVER,
               reason: "forbidden",
            },
         },
      });
   });
});

const runAudit = async (kind: "view" | "manage") => {
   const res = {
      locals: { input: { serverId: "server1" } },
   } as unknown as Response;
   const req = { user: { id: "user1", emailVerified: true } } as Request;
   let failure: unknown;
   await new Promise<void>((resolve) => {
      authorizeAudit(kind)(req, res, ((error?: unknown) => {
         failure = error;
         resolve();
      }) as never);
   });
   return { failure: failure as { status: number } | undefined, res };
};

describe("authorizeAudit", () => {
   it("loads settings and the member's reach in a single statement", async () => {
      db.access = [member("ADMIN")];
      db.grants = [grant("allowed-bucket", "VIEWER")];
      const { failure, res } = await runAudit("view");
      expect(failure).toBeUndefined();
      expect(statements()).toBe(1);
      expect(res.locals.audit).toEqual({
         settings: {
            enabled: true,
            level: AuditLevel.ALL,
            viewRole: Role.ADMIN,
            manageRole: Role.OWNER,
            retentionDays: 30,
         },
         reach: {
            buckets: ["allowed-bucket"],
            ownBuckets: [],
            actorId: "user1",
            serverWide: true,
         },
      });
   });

   it("keeps a non-admin's reach to their own buckets", async () => {
      db.access = [member("VIEWER")];
      db.grants = [grant("allowed-bucket", "VIEWER")];
      db.servers = [{ ...SERVER, auditViewRole: "VIEWER" }];
      const { failure, res } = await runAudit("view");
      expect(failure).toBeUndefined();
      expect(res.locals.audit?.reach).toEqual({
         buckets: ["allowed-bucket"],
         ownBuckets: [],
         actorId: "user1",
         serverWide: false,
      });
   });

   it("gives a member with no grants an empty reach, not a null one", async () => {
      db.access = [member("ADMIN")];
      const { res } = await runAudit("view");
      expect(res.locals.audit?.reach).toEqual({
         buckets: [],
         ownBuckets: [],
         actorId: "user1",
         serverWide: true,
      });
   });

   it("short-circuits an owner to unrestricted reach", async () => {
      db.access = [member("OWNER")];
      db.grants = [grant("allowed-bucket", "VIEWER")];
      const { res } = await runAudit("view");
      expect(res.locals.audit?.reach).toBeNull();
   });

   it("404s a user with no membership row", async () => {
      const { failure } = await runAudit("view");
      expect(failure).toMatchObject({ status: 404 });
   });

   it("403s a member below the configured view role", async () => {
      db.access = [member("VIEWER")];
      const { failure } = await runAudit("view");
      expect(failure).toMatchObject({
         status: 403,
         denial: { entry: { detail: { permission: "audit.view" } } },
      });
   });

   it("403s an admin below the configured manage role", async () => {
      db.access = [member("ADMIN")];
      const { failure } = await runAudit("manage");
      expect(failure).toMatchObject({
         status: 403,
         denial: { entry: { detail: { permission: "audit.manage" } } },
      });
   });
});
