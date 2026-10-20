// imported first: the database mock factory below runs while later imports are still loading.
import { scopeQueryRaw } from "@/lib/testing/route-harness";
import { bucketCreationStore } from "@/lib/testing/bucket-creation-store";
import { ApiHttpError } from "@/lib/http";
import { authorize } from "@/lib/middleware/authorize";
import { authorizeScopeRows, type DbRole } from "@/lib/testing/scope-probe";
import { Permission } from "@s3-viewer/permissions";
import { Role } from "@s3-viewer/types";
import type { Request, Response } from "express";
import { fakeResponse } from "@/lib/testing/fake-response";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BucketExistsError } from "@/lib/s3/bucket-create";
import { bucketsRouter } from "./buckets";

type Grant = {
   bucketName: string;
   role: DbRole;
   userId?: string;
   updatedAt?: Date;
};
const ACTOR_ID = "actor12345";

const state = vi.hoisted(() => ({
   creationStore: undefined as unknown as ReturnType<
      typeof bucketCreationStore
   >,
   role: "ADMIN" as DbRole | null,
   grants: [] as Grant[],
   invitedOn: [] as {
      email: string;
      role: DbRole;
      bucketAccess: Grant[];
      expiresAt?: Date;
   }[],
   allowed: ["original-bucket"],
   restricted: true,
   credentials: "encrypted-a",
   provider: "S3",
   open: 0,
   events: [] as string[],
   create: vi.fn(),
   decrypt: vi.fn(),
   assertPublicEndpoint: vi.fn(),
   buildClient: vi.fn(),
   cachedClient: vi.fn(),
   server: { findUnique: vi.fn() },
   listBuckets: vi.fn(),
   grantsOf: vi.fn(),
   transaction: vi.fn(),
   onPermissionLock: vi.fn(),
   invites: vi.fn(),
   auditMany: vi.fn(),
   createLimit: vi.fn(),
   canHead: vi.fn(),
}));

vi.mock("@/lib/middleware/rate-limit", () => ({
   bucketCreateLimit: [
      (_req: unknown, _res: unknown, next: () => void) => {
         state.createLimit(state.events.length);
         next();
      },
   ],
}));
vi.mock("@/lib/utils/encryption", () => ({
   decryptCredentials: state.decrypt,
}));
vi.mock("@/lib/utils/endpoint", async (original) => ({
   ...(await original<typeof import("@/lib/utils/endpoint")>()),
   assertPublicEndpoint: state.assertPublicEndpoint,
}));
vi.mock("@/lib/middleware/audit-record", () => ({
   record: vi.fn(),
   recordMany: state.auditMany,
}));
vi.mock("@/lib/s3/bucket-create", async (original) => ({
   ...(await original<typeof import("@/lib/s3/bucket-create")>()),
   createNewBucket: state.create,
}));
vi.mock("@/lib/s3/probe", () => ({ canHeadBucket: state.canHead }));
vi.mock("@/lib/s3/bucket-listing", () => ({ listBuckets: state.listBuckets }));
vi.mock("@/lib/s3/client-cache", () => ({
   getS3Client: state.cachedClient,
   getS3ClientFromCredentials: state.buildClient,
}));
vi.mock("@s3-viewer/db", () => ({
   prisma: {
      bucketCreation: new Proxy(
         {},
         {
            get: (_target, key) =>
               state.creationStore.bucketCreation[
                  key as keyof typeof state.creationStore.bucketCreation
               ],
         }
      ),
      server: state.server,
      bucketAccess: { findMany: state.grantsOf },
      // deferred: scopeMember is declared below this hoisted factory.
      $queryRaw: scopeQueryRaw(() => scopeMember()),
      $transaction: state.transaction,
   },
}));

const folderDefaults = { restrictedFolders: false, allowedFolders: [] };

const scope = () => ({
   restrictedBuckets: state.restricted,
   allowedBuckets: state.allowed,
});

const scopeMember = () =>
   state.role
      ? {
           role: state.role,
           ...scope(),
           credentials: state.credentials,
           provider: state.provider,
           ownerId: "owner12345",
           grants: state.grants,
        }
      : null;

beforeEach(() => {
   state.creationStore = bucketCreationStore();
   state.role = "ADMIN";
   state.grants = [];
   state.invitedOn = [];
   state.allowed = ["original-bucket"];
   state.restricted = true;
   state.credentials = "encrypted-a";
   state.provider = "S3";
   state.open = 0;
   state.events = [];
   state.onPermissionLock.mockReset();
   state.invites.mockReset().mockResolvedValue([]);
   state.auditMany.mockReset().mockResolvedValue(undefined);
   state.createLimit.mockReset();
   state.canHead.mockReset().mockResolvedValue(false);
   state.create.mockReset().mockResolvedValue(undefined);
   state.decrypt.mockReset().mockImplementation((encrypted: string) => ({
      endpoint: `https://${encrypted}.example.com`,
      region: "us-east-1",
      accessKey: encrypted,
      secretKey: "secret",
   }));
   state.assertPublicEndpoint.mockReset().mockResolvedValue(undefined);
   state.buildClient
      .mockReset()
      .mockImplementation((credentials: unknown) => ({ credentials }));
   state.cachedClient.mockReset();
   state.listBuckets.mockReset().mockResolvedValue([]);
   state.grantsOf
      .mockReset()
      .mockImplementation(async () =>
         [...state.grants]
            .sort((a, b) => a.bucketName.localeCompare(b.bucketName))
            .map((grant) => ({ ...folderDefaults, ...grant }))
      );
   state.server.findUnique.mockReset();
   state.server.findUnique.mockImplementation(async () => ({
      ...scope(),
      provider: state.provider,
      credentials: state.credentials,
      ownerId: "owner12345",
   }));
   state.transaction
      .mockReset()
      .mockImplementation(async (work: (tx: unknown) => Promise<unknown>) => {
         const tx = {
            bucketCreation: state.creationStore.bucketCreation,
            $queryRaw: async (
               strings: TemplateStringsArray,
               ...values: unknown[]
            ) => {
               const rows = authorizeScopeRows(strings, values, scopeMember);
               if (rows) {
                  state.events.push("transaction-role");
                  return rows;
               }
               state.events.push("permission-lock");
               await state.onPermissionLock();
               return [scope()];
            },
            $executeRaw: async (
               strings: TemplateStringsArray,
               bucket: string
            ) => {
               if (strings.join("").includes("pg_advisory_xact_lock")) return 0;
               if (strings.join("").includes("array_remove")) {
                  state.events.push("scope-remove");
                  state.allowed = state.allowed.filter(
                     (name) => name !== bucket
                  );
               } else {
                  state.allowed.push(bucket);
               }
               return 1;
            },
            serverAccess: {
               findUnique: async () => {
                  state.events.push("transaction-role");
                  return state.role ? { role: state.role } : null;
               },
               findMany: async () => [],
            },
            server: state.server,
            pendingInvitation: {
               findMany: (args: {
                  where: {
                     expiresAt?: { gt: Date };
                     bucketAccess?: { some: { bucketName: string } };
                  };
               }) =>
                  args.where.bucketAccess
                     ? state.invitedOn
                          .filter(
                             (invite) =>
                                (invite.expiresAt ?? new Date(8.64e15)) >
                                   (args.where.expiresAt?.gt ?? new Date(0)) &&
                                invite.bucketAccess.some(
                                   (grant) =>
                                      grant.bucketName ===
                                      args.where.bucketAccess?.some.bucketName
                                )
                          )
                          .map((invite) => ({
                             ...invite,
                             bucketAccess: invite.bucketAccess.map((grant) => ({
                                ...folderDefaults,
                                ...grant,
                             })),
                          }))
                     : state.invites(args),
               deleteMany: async () => ({ count: 1 }),
            },
            bucketAccess: {
               findMany: async ({
                  where,
               }: {
                  where: {
                     bucketName: string | { in: string[] };
                     userId: string | { not: string };
                  };
               }) =>
                  state.grants
                     .filter((grant) => {
                        const holder = grant.userId ?? ACTOR_ID;
                        const names =
                           typeof where.bucketName === "string"
                              ? [where.bucketName]
                              : where.bucketName.in;
                        return (
                           names.includes(grant.bucketName) &&
                           (typeof where.userId === "string"
                              ? holder === where.userId
                              : holder !== where.userId.not)
                        );
                     })
                     .map((grant) => ({ ...folderDefaults, ...grant })),
               deleteMany: async ({
                  where,
               }: {
                  where: { bucketName: string; updatedAt?: { lt: Date } };
               }) => {
                  const before = where.updatedAt?.lt;
                  if (!before) state.events.push("grants-remove");
                  const kept = state.grants.filter(
                     (grant) =>
                        grant.bucketName !== where.bucketName ||
                        (before !== undefined &&
                           (grant.updatedAt ?? new Date(0)) >= before)
                  );
                  const count = state.grants.length - kept.length;
                  state.grants = kept;
                  return { count };
               },
               upsert: async ({ create }: { create: Grant }) => {
                  const existing = state.grants.find(
                     (grant) =>
                        grant.bucketName === create.bucketName &&
                        (grant.userId ?? ACTOR_ID) === create.userId
                  );
                  if (existing) return { ...folderDefaults, ...existing };
                  state.grants.push(create);
                  return { ...folderDefaults, ...create };
               },
            },
         };
         state.open++;
         try {
            return await work(tx);
         } finally {
            state.open--;
         }
      });
});

const requestBucket = (
   method: "get" | "post" | "delete",
   serverId = "server12345",
   bucketName = "new-bucket"
) => {
   const route = bucketsRouter.stack.find((layer) =>
      layer.route?.stack.some((handler) => handler.method === method)
   )?.route;
   if (!route) throw new Error("Bucket route not found");
   const req = {
      user: { id: ACTOR_ID },
      params: {
         serverId,
         ...(method === "delete" ? { bucketName } : {}),
      },
      body: { bucketName },
      query: {},
   } as unknown as Request;
   const res = fakeResponse();
   const failed = Promise.withResolvers<never>();
   let index = 0;
   const next = (error?: unknown) => {
      if (error) {
         failed.reject(error);
         return;
      }
      const handler = route.stack[index++];
      if (!handler) {
         failed.reject(new Error("Bucket route did not respond"));
         return;
      }
      handler.handle(req, res, next);
   };
   next();
   return { req, res, finished: Promise.race([res.sent, failed.promise]) };
};

const postBucket = (serverId?: string) => requestBucket("post", serverId);

const listBucketsRoute = async (): Promise<
   { name: string; userRole: Role }[]
> => ((await requestBucket("get").finished) as { buckets: never[] }).buckets;

describe("bucket listing", () => {
   const expectNoServerRead = () => {
      expect(state.server.findUnique).not.toHaveBeenCalled();
   };

   it("filters a member's grants through the allow-list without re-reading the server", async () => {
      state.grants = [
         { bucketName: "original-bucket", role: "EDITOR" },
         { bucketName: "revoked-bucket", role: "ADMIN" },
      ];
      expect(await listBucketsRoute()).toEqual([
         {
            name: "original-bucket",
            creationDate: null,
            userRole: Role.EDITOR,
            folders: null,
         },
      ]);
      expectNoServerRead();
      expect(state.cachedClient).not.toHaveBeenCalled();
   });

   it("answers an owner from the allow-list without re-reading the server", async () => {
      state.role = "OWNER";
      state.allowed = ["original-bucket", "second-bucket"];
      expect(await listBucketsRoute()).toEqual([
         {
            name: "original-bucket",
            creationDate: null,
            userRole: Role.OWNER,
            folders: null,
         },
         {
            name: "second-bucket",
            creationDate: null,
            userRole: Role.OWNER,
            folders: null,
         },
      ]);
      expectNoServerRead();
      expect(state.listBuckets).not.toHaveBeenCalled();
   });

   it("asks storage for an owner on an unrestricted server, still without re-reading it", async () => {
      state.role = "OWNER";
      state.restricted = false;
      state.listBuckets.mockResolvedValue([
         { Name: "from-storage", CreationDate: new Date(0) },
      ]);
      expect(await listBucketsRoute()).toEqual([
         {
            name: "from-storage",
            creationDate: "1970-01-01T00:00:00.000Z",
            userRole: Role.OWNER,
            folders: null,
         },
      ]);
      expectNoServerRead();
      expect(state.cachedClient).toHaveBeenCalledOnce();
   });

   it("cancels a bucket reader while client resolution is pending", async () => {
      state.role = "OWNER";
      state.restricted = false;
      const started = Promise.withResolvers<void>();
      state.cachedClient.mockImplementation(
         (_auth, _bucket, signal: AbortSignal) => {
            started.resolve();
            return new Promise((_resolve, reject) => {
               signal.addEventListener("abort", () => reject(signal.reason), {
                  once: true,
               });
            });
         }
      );
      const request = requestBucket("get");
      await started.promise;
      request.res.emit("close");
      await expect(request.finished).rejects.toMatchObject({
         name: "AbortError",
      });
      expect(state.listBuckets).not.toHaveBeenCalled();
   });
});

describe("bucket creation authorization", () => {
   beforeEach(() => {
      state.restricted = false;
   });

   it("builds S3 operations from the authorization snapshot instead of the cache", async () => {
      await postBucket().finished;
      expect(state.cachedClient).not.toHaveBeenCalled();
      expect(state.server.findUnique).toHaveBeenCalledOnce();
      expect(state.decrypt).toHaveBeenCalledWith("encrypted-a", "owner12345");
      expect(state.assertPublicEndpoint).toHaveBeenCalledWith(
         "https://encrypted-a.example.com"
      );
      expect(state.create).toHaveBeenCalledWith(
         { credentials: expect.objectContaining({ accessKey: "encrypted-a" }) },
         "S3",
         "new-bucket",
         expect.any(AbortSignal),
         expect.objectContaining({
            submitted: expect.any(Function),
            settled: expect.any(Function),
         })
      );
      expect(state.auditMany).toHaveBeenCalledExactlyOnceWith(
         expect.anything(),
         [
            {
               action: "bucket.create",
               bucket: "new-bucket",
            },
         ]
      );
   });

   it.each(["credentials", "provider"] as const)(
      "adds no scope or grants when %s changes during S3 creation",
      async (field) => {
         const started = Promise.withResolvers<void>();
         const completion = Promise.withResolvers<void>();
         state.create.mockImplementation(async () => {
            started.resolve();
            await completion.promise;
         });
         const request = postBucket();
         await started.promise;
         state[field] = field === "credentials" ? "encrypted-b" : "Other";
         completion.resolve();
         await expect(request.finished).rejects.toMatchObject({ status: 409 });
         expect(state.allowed).toEqual(["original-bucket"]);
         expect(state.grants).toEqual([]);
         expect(state.events).toEqual(["permission-lock"]);
      }
   );

   it("spends the bucket creation rate limit before any authorization or storage work, and only on creation", async () => {
      await postBucket().finished;
      expect(state.createLimit).toHaveBeenCalledExactlyOnceWith(0);
      state.createLimit.mockClear();
      await listBucketsRoute();
      expect(state.createLimit).not.toHaveBeenCalled();
   });

   it("opens no transaction while storage creates the bucket", async () => {
      let openDuringCreate = -1;
      state.create.mockImplementation(async () => {
         openDuringCreate = state.open;
      });
      await postBucket().finished;
      expect(openDuringCreate).toBe(0);
      expect(state.events).toEqual(["permission-lock", "transaction-role"]);
   });

   it("checks existing buckets for owners and saves no access when the bucket exists", async () => {
      state.role = "OWNER";
      state.create.mockRejectedValue(new BucketExistsError("new-bucket"));
      await expect(postBucket().finished).rejects.toMatchObject({
         status: 409,
      });
      expect(state.create).toHaveBeenCalledTimes(1);
      expect(state.canHead).not.toHaveBeenCalled();
      expect(state.grants).toEqual([]);
      expect(state.allowed).toEqual(["original-bucket"]);
      expect(state.auditMany).not.toHaveBeenCalled();
   });

   it("lets the owner put an existing bucket its credentials reach back on the allow-list", async () => {
      state.role = "OWNER";
      state.restricted = true;
      state.create.mockRejectedValue(new BucketExistsError("new-bucket"));
      state.canHead.mockResolvedValue(true);
      const request = postBucket();
      await expect(request.finished).resolves.toEqual({
         bucket: {
            name: "new-bucket",
            creationDate: null,
            userRole: Role.OWNER,
            folders: null,
         },
         existing: true,
      });
      expect(request.res.statusCode).toBe(201);
      expect(state.allowed).toEqual(["original-bucket", "new-bucket"]);
      expect(state.grants).toEqual([]);
      expect(state.auditMany.mock.calls[0]?.[1]).toEqual([
         {
            action: "bucket.create",
            bucket: "new-bucket",
            detail: { existing: true },
         },
      ]);
   });

   it("keeps answering 409 for an existing bucket the owner's credentials can't reach", async () => {
      state.role = "OWNER";
      state.restricted = true;
      state.create.mockRejectedValue(new BucketExistsError("new-bucket"));
      await expect(postBucket().finished).rejects.toMatchObject({
         status: 409,
      });
      expect(state.canHead).toHaveBeenCalledOnce();
      expect(state.allowed).toEqual(["original-bucket"]);
      expect(state.auditMany).not.toHaveBeenCalled();
   });

   it("keeps answering 409 to anyone but the owner for an existing bucket", async () => {
      state.create.mockRejectedValue(new BucketExistsError("new-bucket"));
      state.canHead.mockResolvedValue(true);
      await expect(postBucket().finished).rejects.toMatchObject({
         status: 409,
      });
      expect(state.canHead).not.toHaveBeenCalled();
      expect(state.allowed).toEqual(["original-bucket"]);
      expect(state.auditMany).not.toHaveBeenCalled();
   });

   it.each(["VIEWER", null] as const)(
      "does not restore access after the creator is changed to %s during S3 creation",
      async (role) => {
         const started = Promise.withResolvers<void>();
         const completion = Promise.withResolvers<void>();
         state.create.mockImplementation(async () => {
            started.resolve();
            await completion.promise;
         });
         const request = postBucket();
         await started.promise;
         expect(state.events).toEqual([]);
         state.role = role;
         completion.resolve();
         await expect(request.finished).rejects.toMatchObject({ status: 403 });
         expect(state.grants).toEqual([]);
         expect(state.allowed).toEqual(["original-bucket"]);
         expect(state.events).toEqual(["permission-lock", "transaction-role"]);
         const res = {
            locals: {
               input: {
                  serverId: "server12345",
                  bucketName: "original-bucket",
               },
            },
         } as unknown as Response;
         await expect(
            new Promise<void>((resolve, reject) => {
               authorize(Permission.DELETE_OBJECT, { scope: "bucket" })(
                  request.req,
                  res,
                  (error) => (error ? reject(error) : resolve())
               );
            })
         ).rejects.toMatchObject({ status: 404 });
      }
   );

   it("uses the current editor role after an admin is demoted during S3 creation", async () => {
      state.create.mockImplementation(async () => {
         state.role = "EDITOR";
      });
      await expect(postBucket().finished).resolves.toMatchObject({
         bucket: { userRole: Role.EDITOR },
      });
      expect(state.grants).toEqual([
         expect.objectContaining({ bucketName: "new-bucket", role: "EDITOR" }),
      ]);
   });

   it("preserves a bucket grant reduced while creation was in flight", async () => {
      state.create.mockImplementation(async () => {
         state.grants = [
            { bucketName: "new-bucket", role: "VIEWER", updatedAt: new Date() },
         ];
      });
      await expect(postBucket().finished).resolves.toMatchObject({
         bucket: { userRole: Role.VIEWER },
      });
      expect(state.grants[0]?.role).toBe("VIEWER");
      expect(state.invites).not.toHaveBeenCalled();
   });

   it("clears grants left on the name by an earlier bucket, for other members and the creator", async () => {
      const before = new Date(Date.now() - 60_000);
      state.grants = [
         {
            bucketName: "new-bucket",
            role: "EDITOR",
            userId: "member1234",
            updatedAt: before,
         },
         { bucketName: "new-bucket", role: "VIEWER", updatedAt: before },
         {
            bucketName: "original-bucket",
            role: "EDITOR",
            userId: "member1234",
            updatedAt: before,
         },
      ];
      await expect(postBucket().finished).resolves.toMatchObject({
         bucket: { userRole: Role.ADMIN },
      });
      expect(state.grants).toEqual([
         expect.objectContaining({
            bucketName: "original-bucket",
            userId: "member1234",
         }),
         expect.objectContaining({
            bucketName: "new-bucket",
            userId: ACTOR_ID,
            role: "ADMIN",
         }),
      ]);
      expect(state.invites).toHaveBeenCalledOnce();
      expect(state.auditMany).toHaveBeenCalledExactlyOnceWith(
         expect.anything(),
         [
            {
               action: "bucket.create",
               bucket: "new-bucket",
               detail: { clearedGrants: 2 },
            },
         ]
      );
   });

   it("records each invite revoked because its sender can no longer grant the name", async () => {
      state.grants = [
         {
            bucketName: "new-bucket",
            role: "EDITOR",
            userId: "member1234",
            updatedAt: new Date(Date.now() - 60_000),
         },
      ];
      state.invites.mockResolvedValue([
         {
            id: "invite1234",
            email: "guest@example.test",
            expiresAt: new Date(Date.now() + 60_000),
            invitedById: "member1234",
            serverId: "server1234",
            role: "VIEWER",
            bucketAccess: [],
         },
      ]);
      await postBucket().finished;
      expect(state.auditMany).toHaveBeenCalledExactlyOnceWith(
         expect.anything(),
         [
            expect.objectContaining({ action: "bucket.create" }),
            {
               action: "invite.revoke",
               target: "guest@example.test",
               detail: { reason: "sender_authority" },
            },
         ]
      );
   });

   it("clears earlier grants on the name when the owner creates the bucket", async () => {
      state.role = "OWNER";
      state.grants = [
         {
            bucketName: "new-bucket",
            role: "EDITOR",
            userId: "member1234",
            updatedAt: new Date(Date.now() - 60_000),
         },
      ];
      await expect(postBucket().finished).resolves.toMatchObject({
         bucket: { userRole: Role.OWNER },
      });
      expect(state.grants).toEqual([]);
      expect(state.invites).toHaveBeenCalledOnce();
   });

   it("keeps earlier grants when the bucket was not created", async () => {
      const grant = {
         bucketName: "new-bucket",
         role: "EDITOR" as const,
         userId: "member1234",
         updatedAt: new Date(Date.now() - 60_000),
      };
      state.grants = [grant];
      state.create.mockRejectedValue(
         new ApiHttpError(409, "new-bucket already exists")
      );
      await expect(postBucket().finished).rejects.toMatchObject({
         status: 409,
      });
      expect(state.grants).toEqual([grant]);
      expect(state.invites).not.toHaveBeenCalled();
   });

   it("holds a new bucket to the current naming rules", async () => {
      const request = requestBucket("post", undefined, "Company_Backups");
      await expect(request.finished).resolves.toEqual({
         code: "VALIDATION",
         message: "bucketName: Invalid bucket name",
      });
      expect(request.res.statusCode).toBe(400);
      expect(state.create).not.toHaveBeenCalled();
      expect(state.creationStore.rows.size).toBe(0);
   });

   it("rejects concurrent creation of the same bucket through another server connection", async () => {
      const started = Promise.withResolvers<void>();
      const completion = Promise.withResolvers<void>();
      state.create.mockImplementation(async () => {
         started.resolve();
         await completion.promise;
      });
      const first = postBucket();
      await started.promise;
      await expect(postBucket("server67890").finished).rejects.toMatchObject({
         status: 409,
      });
      expect(state.create).toHaveBeenCalledTimes(1);
      completion.resolve();
      await expect(first.finished).resolves.toMatchObject({
         bucket: { userRole: Role.ADMIN },
      });
      state.create.mockResolvedValue(undefined);
      await expect(postBucket("server67890").finished).resolves.toBeDefined();
      expect(state.create).toHaveBeenCalledTimes(2);
   });

   it("passes client disconnects to the bounded S3 operation", async () => {
      const started = Promise.withResolvers<void>();
      const completion = Promise.withResolvers<void>();
      let signal: AbortSignal | undefined;
      state.create.mockImplementation(
         async (_client, _provider, _bucket, requestSignal: AbortSignal) => {
            signal = requestSignal;
            started.resolve();
            await completion.promise;
            requestSignal.throwIfAborted();
         }
      );
      const request = postBucket();
      await started.promise;
      request.res.emit("close");
      expect(signal?.aborted).toBe(true);
      completion.resolve();
      await expect(request.finished).rejects.toMatchObject({
         name: "AbortError",
      });
      expect(state.grants).toEqual([]);
      state.create.mockResolvedValue(undefined);
      await expect(postBucket().finished).resolves.toBeDefined();
   });

   describe("on a server restricted to an allow-list", () => {
      beforeEach(() => {
         state.restricted = true;
      });

      it.each(["ADMIN", "EDITOR"] as const)(
         "refuses a %s and never touches storage or the allow-list",
         async (role) => {
            state.role = role;
            await expect(postBucket().finished).rejects.toMatchObject({
               name: "AccessDenied",
               status: 403,
            });
            expect(state.create).not.toHaveBeenCalled();
            expect(state.decrypt).not.toHaveBeenCalled();
            expect(state.auditMany).not.toHaveBeenCalled();
            expect(state.allowed).toEqual(["original-bucket"]);
            expect(state.grants).toEqual([]);
         }
      );

      it("lets the owner create a bucket and widens the allow-list", async () => {
         state.role = "OWNER";
         await expect(postBucket().finished).resolves.toMatchObject({
            bucket: { userRole: Role.OWNER },
         });
         expect(state.create).toHaveBeenCalledOnce();
         expect(state.allowed).toEqual(["original-bucket", "new-bucket"]);
      });

      it("denies the widening if the owner is demoted while the S3 call is in flight", async () => {
         state.role = "OWNER";
         const started = Promise.withResolvers<void>();
         const completion = Promise.withResolvers<void>();
         state.create.mockImplementation(async () => {
            started.resolve();
            await completion.promise;
         });
         const request = postBucket();
         await started.promise;
         state.role = "ADMIN";
         completion.resolve();
         await expect(request.finished).rejects.toMatchObject({ status: 403 });
         expect(state.grants).toEqual([]);
         expect(state.allowed).toEqual(["original-bucket"]);
      });
   });
});

describe("bucket removal authorization", () => {
   beforeEach(() => {
      state.allowed.push("new-bucket");
      state.grants = [{ bucketName: "new-bucket", role: "ADMIN" }];
   });

   const expectUntouched = () => {
      expect(state.allowed).toEqual(["original-bucket", "new-bucket"]);
      expect(state.invites).not.toHaveBeenCalled();
   };

   const expectRemoved = (request: ReturnType<typeof requestBucket>) => {
      expect(request.res.statusCode).toBe(204);
      expect(state.events).toEqual([
         "permission-lock",
         "transaction-role",
         "scope-remove",
         "grants-remove",
      ]);
      expect(state.allowed).toEqual(["original-bucket"]);
      expect(state.grants).toEqual([]);
      expect(state.invites).toHaveBeenCalledOnce();
      expect(state.auditMany).toHaveBeenCalledExactlyOnceWith(
         expect.anything(),
         [
            {
               action: "bucket.remove",
               bucket: "new-bucket",
            },
         ]
      );
   };

   // EDITOR is the highest role without DELETE_BUCKET, so it stands for every lower one.
   it.each(["EDITOR", null] as const)(
      "changes no scope, grants or invites after the actor becomes %s while waiting for the server lock",
      async (role) => {
         state.onPermissionLock.mockImplementation(() => {
            state.role = role;
            if (role) state.grants = [{ bucketName: "new-bucket", role }];
         });
         await expect(requestBucket("delete").finished).rejects.toMatchObject({
            status: role ? 403 : 404,
         });
         expect(state.events).toEqual(["permission-lock", "transaction-role"]);
         expect(state.grants).toEqual([
            { bucketName: "new-bucket", role: role ?? "ADMIN" },
         ]);
         expect(state.auditMany).not.toHaveBeenCalled();
         expectUntouched();
      }
   );

   it("permits an admin holding admin access on the bucket to remove it", async () => {
      const request = requestBucket("delete");
      await expect(request.finished).resolves.toBeUndefined();
      expectRemoved(request);
   });

   it("reaches an existing bucket whose name predates the current naming rules", async () => {
      state.allowed.push("Company_Backups");
      state.grants = [{ bucketName: "Company_Backups", role: "ADMIN" }];
      const request = requestBucket("delete", undefined, "Company_Backups");
      await expect(request.finished).resolves.toBeUndefined();
      expect(request.res.statusCode).toBe(204);
      expect(state.allowed).toEqual(["original-bucket", "new-bucket"]);
      expect(state.grants).toEqual([]);
   });

   it("permits an owner holding no grant on the bucket to remove it", async () => {
      state.role = "OWNER";
      state.grants = [{ bucketName: "new-bucket", role: "EDITOR" }];
      const request = requestBucket("delete");
      await expect(request.finished).resolves.toBeUndefined();
      expectRemoved(request);
   });

   it("permits an admin to remove a bucket whose other grants sit below their own", async () => {
      state.grants = [
         { bucketName: "new-bucket", role: "ADMIN" },
         { bucketName: "new-bucket", role: "EDITOR", userId: "peer1234567" },
         { bucketName: "new-bucket", role: "VIEWER", userId: "peer7654321" },
      ];
      const request = requestBucket("delete");
      await expect(request.finished).resolves.toBeUndefined();
      expect(request.res.statusCode).toBe(204);
      expect(state.grants).toEqual([]);
      expect(state.allowed).toEqual(["original-bucket"]);
   });

   it("refuses an admin when another admin holds the bucket", async () => {
      state.grants = [
         { bucketName: "new-bucket", role: "ADMIN" },
         { bucketName: "new-bucket", role: "ADMIN", userId: "peer1234567" },
      ];
      await expect(requestBucket("delete").finished).rejects.toMatchObject({
         status: 403,
         message: expect.stringContaining("Admin access to new-bucket"),
      });
      expect(state.events).toEqual(["permission-lock", "transaction-role"]);
      expect(state.grants).toHaveLength(2);
      expect(state.auditMany).not.toHaveBeenCalled();
      expect(state.invites).not.toHaveBeenCalled();
      expectUntouched();
   });

   const invite = (role: DbRole, ...bucketAccess: Grant[]) => ({
      email: "invitee@example.com",
      role,
      bucketAccess,
   });

   it.each([
      [
         "grants admin on the bucket",
         invite("VIEWER", { bucketName: "new-bucket", role: "ADMIN" }),
      ],
      [
         "also grants a bucket the admin doesn't hold",
         invite(
            "VIEWER",
            { bucketName: "new-bucket", role: "VIEWER" },
            { bucketName: "finance", role: "EDITOR" }
         ),
      ],
      [
         "outranks the admin",
         invite("ADMIN", { bucketName: "new-bucket", role: "VIEWER" }),
      ],
   ])("refuses an admin when a pending invite %s", async (_case, pending) => {
      state.invitedOn = [pending];
      await expect(requestBucket("delete").finished).rejects.toMatchObject({
         status: 403,
         message: expect.stringContaining("A pending invite carries access"),
      });
      expect(state.grants).toHaveLength(1);
      expect(state.auditMany).not.toHaveBeenCalled();
      expectUntouched();
   });

   it("permits an admin to remove a bucket whose invites the admin could revoke", async () => {
      state.grants.push({ bucketName: "finance", role: "EDITOR" });
      state.invitedOn = [
         invite(
            "EDITOR",
            { bucketName: "new-bucket", role: "EDITOR" },
            { bucketName: "finance", role: "VIEWER" }
         ),
      ];
      const request = requestBucket("delete");
      await expect(request.finished).resolves.toBeUndefined();
      expect(request.res.statusCode).toBe(204);
      expect(state.allowed).toEqual(["original-bucket"]);
   });

   it("names no invitee to a bucket admin who can't list invites", async () => {
      state.role = "EDITOR";
      state.invitedOn = [
         invite("VIEWER", { bucketName: "new-bucket", role: "VIEWER" }),
      ];
      const failure = await requestBucket("delete").finished.catch(
         (error: unknown) => error
      );
      expect(failure).toMatchObject({
         status: 403,
         message: expect.stringContaining("A pending invite carries access"),
      });
      expect(JSON.stringify(failure)).not.toContain("invitee@example.com");
      expectUntouched();
   });

   it("ignores an expired invite that grants admin on the bucket", async () => {
      state.invitedOn = [
         {
            ...invite("VIEWER", { bucketName: "new-bucket", role: "ADMIN" }),
            expiresAt: new Date(Date.now() - 1000),
         },
      ];
      const request = requestBucket("delete");
      await expect(request.finished).resolves.toBeUndefined();
      expectRemoved(request);
   });

   it("lets an owner remove a bucket a pending invite grants admin on", async () => {
      state.role = "OWNER";
      state.invitedOn = [
         invite("ADMIN", { bucketName: "new-bucket", role: "ADMIN" }),
      ];
      const request = requestBucket("delete");
      await expect(request.finished).resolves.toBeUndefined();
      expect(request.res.statusCode).toBe(204);
   });

   it("lets an owner remove a bucket that other admins hold", async () => {
      state.role = "OWNER";
      state.grants = [
         { bucketName: "new-bucket", role: "ADMIN", userId: "peer1234567" },
      ];
      const request = requestBucket("delete");
      await expect(request.finished).resolves.toBeUndefined();
      expect(request.res.statusCode).toBe(204);
      expect(state.grants).toEqual([]);
   });

   it("hides the bucket from an admin who holds no grant on it", async () => {
      state.grants = [];
      await expect(requestBucket("delete").finished).rejects.toMatchObject({
         status: 404,
         message: "Bucket not found",
      });
      expect(state.events).toEqual([]);
      expectUntouched();
   });

   it("refuses an admin who holds only EDITOR access on the bucket", async () => {
      state.grants = [{ bucketName: "new-bucket", role: "EDITOR" }];
      await expect(requestBucket("delete").finished).rejects.toMatchObject({
         status: 403,
      });
      expect(state.events).toEqual([]);
      expect(state.grants).toEqual([
         { bucketName: "new-bucket", role: "EDITOR" },
      ]);
      expectUntouched();
   });

   it("hides a bucket outside the server's allow list from an admin", async () => {
      state.allowed = ["original-bucket"];
      await expect(requestBucket("delete").finished).rejects.toMatchObject({
         status: 404,
      });
      expect(state.events).toEqual([]);
      expect(state.allowed).toEqual(["original-bucket"]);
      expect(state.invites).not.toHaveBeenCalled();
   });

   it("still refuses removal of the last allowed bucket", async () => {
      state.allowed = ["new-bucket"];
      await expect(requestBucket("delete").finished).rejects.toMatchObject({
         status: 409,
      });
      expect(state.allowed).toEqual(["new-bucket"]);
      expect(state.grants).toHaveLength(1);
      expect(state.invites).not.toHaveBeenCalled();
   });
});
