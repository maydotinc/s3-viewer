import { ApiHttpError } from "@/lib/http";
import { authorize } from "@/lib/middleware/authorize";
import { Permission } from "@s3-viewer/permissions";
import { Role } from "@s3-viewer/types";
import type { Request, Response } from "express";
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bucketsRouter } from "./buckets";

type StoredRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
type Grant = { bucketName: string; role: StoredRole };

const state = vi.hoisted(() => ({
   role: "ADMIN" as StoredRole | null,
   grants: [] as Grant[],
   allowed: ["original-bucket"],
   credentials: "encrypted-a",
   provider: "S3",
   locked: false,
   events: [] as string[],
   create: vi.fn(),
   decrypt: vi.fn(),
   assertPublicEndpoint: vi.fn(),
   buildClient: vi.fn(),
   cachedClient: vi.fn(),
   server: { findUnique: vi.fn() },
   serverAccess: { findUnique: vi.fn() },
   transaction: vi.fn(),
}));

vi.mock("@/lib/utils/encryption", () => ({
   decryptCredentials: state.decrypt,
}));
vi.mock("@/lib/utils/endpoint", async (original) => ({
   ...(await original<typeof import("@/lib/utils/endpoint")>()),
   assertPublicEndpoint: state.assertPublicEndpoint,
}));
vi.mock("@/lib/services/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/s3/bucket-create", () => ({ createNewBucket: state.create }));
vi.mock("@/lib/s3/client-cache", () => ({
   getS3Client: state.cachedClient,
   getS3ClientFromCredentials: state.buildClient,
}));
vi.mock("@s3-viewer/db", () => ({
   prisma: {
      server: state.server,
      serverAccess: state.serverAccess,
      $transaction: state.transaction,
   },
}));

const scope = () => ({
   restrictedBuckets: true,
   allowedBuckets: state.allowed,
});

beforeEach(() => {
   state.role = "ADMIN";
   state.grants = [];
   state.allowed = ["original-bucket"];
   state.credentials = "encrypted-a";
   state.provider = "S3";
   state.locked = false;
   state.events = [];
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
   state.server.findUnique.mockImplementation(async () => ({
      ...scope(),
      provider: state.provider,
      credentials: state.credentials,
   }));
   state.serverAccess.findUnique.mockImplementation(
      async () =>
         state.role && {
            role: state.role,
            server: { ...scope(), bucketAccess: state.grants },
         }
   );
   state.transaction
      .mockReset()
      .mockImplementation(async (work: (tx: unknown) => Promise<unknown>) => {
         let held = false;
         const tx = {
            $queryRaw: async (strings: TemplateStringsArray) => {
               if (strings.join("").includes("pg_try_advisory_xact_lock")) {
                  if (state.locked) return [{ locked: false }];
                  state.locked = held = true;
                  state.events.push("creation-lock");
                  return [{ locked: true }];
               }
               state.events.push("permission-lock");
               return [scope()];
            },
            $executeRaw: async (
               _strings: TemplateStringsArray,
               bucket: string
            ) => {
               state.allowed.push(bucket);
               return 1;
            },
            serverAccess: state.serverAccess,
            server: state.server,
            bucketAccess: {
               upsert: async ({ create }: { create: Grant }) => {
                  const existing = state.grants.find(
                     (grant) => grant.bucketName === create.bucketName
                  );
                  if (existing) return existing;
                  state.grants.push(create);
                  return create;
               },
            },
         };
         try {
            return await work(tx);
         } finally {
            if (held) state.locked = false;
         }
      });
});

const postBucket = (serverId = "server12345") => {
   const route = bucketsRouter.stack.find((layer) =>
      layer.route?.stack.some((handler) => handler.method === "post")
   )?.route;
   if (!route) throw new Error("Bucket creation route not found");
   const req = {
      user: { id: "actor12345" },
      params: { serverId },
      body: { bucketName: "new-bucket" },
      query: {},
   } as unknown as Request;
   const res = new EventEmitter() as unknown as Response;
   res.locals = {};
   res.status = (code: number) => {
      res.statusCode = code;
      return res;
   };
   const finished = new Promise<unknown>((resolve, reject) => {
      res.json = (body: unknown) => {
         resolve(body);
         return res;
      };
      let index = 0;
      const next = (error?: unknown) => {
         if (error) {
            reject(error);
            return;
         }
         const handler = route.stack[index++];
         if (!handler) {
            reject(new Error("Bucket creation route did not respond"));
            return;
         }
         handler.handle(req, res, next);
      };
      next();
   });
   return { req, res, finished };
};

const deferred = () => {
   let resolve!: () => void;
   const promise = new Promise<void>((done) => {
      resolve = done;
   });
   return { promise, resolve };
};

describe("bucket creation authorization", () => {
   it("builds S3 operations from the database credential snapshot instead of the cache", async () => {
      await postBucket().finished;
      expect(state.cachedClient).not.toHaveBeenCalled();
      expect(state.decrypt).toHaveBeenCalledWith("encrypted-a");
      expect(state.assertPublicEndpoint).toHaveBeenCalledWith(
         "https://encrypted-a.example.com"
      );
      expect(state.create).toHaveBeenCalledWith(
         { credentials: expect.objectContaining({ accessKey: "encrypted-a" }) },
         "S3",
         "new-bucket",
         expect.any(AbortSignal)
      );
   });

   it.each(["credentials", "provider"] as const)(
      "adds no scope or grants when %s changes during S3 creation",
      async (field) => {
         const started = deferred();
         const completion = deferred();
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
         expect(state.events).toEqual(["creation-lock", "permission-lock"]);
      }
   );

   it("checks existing buckets for owners and saves no access when the bucket exists", async () => {
      state.role = "OWNER";
      state.create.mockRejectedValue(
         new ApiHttpError(409, "new-bucket already exists")
      );
      await expect(postBucket().finished).rejects.toMatchObject({
         status: 409,
      });
      expect(state.create).toHaveBeenCalledTimes(1);
      expect(state.grants).toEqual([]);
      expect(state.allowed).toEqual(["original-bucket"]);
   });

   it.each(["VIEWER", null] as const)(
      "does not restore access after the creator is changed to %s during S3 creation",
      async (role) => {
         const started = deferred();
         const completion = deferred();
         state.create.mockImplementation(async () => {
            started.resolve();
            await completion.promise;
         });
         const request = postBucket();
         await started.promise;
         expect(state.events).toEqual(["creation-lock"]);
         state.role = role;
         completion.resolve();
         await expect(request.finished).rejects.toMatchObject({ status: 403 });
         expect(state.grants).toEqual([]);
         expect(state.allowed).toEqual(["original-bucket"]);
         expect(state.events).toEqual(["creation-lock", "permission-lock"]);
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
         ).rejects.toMatchObject({ status: role ? 403 : 404 });
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
         state.grants = [{ bucketName: "new-bucket", role: "VIEWER" }];
      });
      await expect(postBucket().finished).resolves.toMatchObject({
         bucket: { userRole: Role.VIEWER },
      });
      expect(state.grants[0]?.role).toBe("VIEWER");
   });

   it("rejects concurrent creation of the same bucket through another server connection", async () => {
      const started = deferred();
      const completion = deferred();
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
      expect(state.locked).toBe(false);
   });

   it("passes client disconnects to the bounded S3 operation", async () => {
      const started = deferred();
      const completion = deferred();
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
      expect(state.locked).toBe(false);
   });
});
