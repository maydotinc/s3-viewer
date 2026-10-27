import { bucketCreationStore } from "@/lib/testing/bucket-creation-store";
import { LOCK_NAMESPACE } from "@/lib/db-locks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   bucketCreationNamespace,
   withBucketCreation,
} from "./bucket-creation-coordination";

const state = vi.hoisted(() => ({
   lock: vi.fn(),
   store: undefined as unknown as ReturnType<typeof bucketCreationStore>,
}));
vi.mock("@/lib/db-locks", async (original) => {
   const actual = await original<typeof import("@/lib/db-locks")>();
   state.lock.mockImplementation(actual.xactLock);
   return { ...actual, xactLock: state.lock };
});
vi.mock("@s3-viewer/db", () => ({
   prisma: new Proxy(
      {},
      { get: (_target, key) => state.store[key as keyof typeof state.store] }
   ),
}));
beforeEach(() => {
   state.store = bucketCreationStore();
});

describe("shared bucket creation coordination", () => {
   it("excludes another actor and replica throughout provider work and the final grant", async () => {
      vi.resetModules();
      const replica = await import("./bucket-creation-coordination");
      const submitted = Promise.withResolvers<void>();
      const completeProvider = Promise.withResolvers<void>();
      const completeGrant = Promise.withResolvers<void>();
      const granting = Promise.withResolvers<void>();
      const loser = vi.fn();
      const winner = withBucketCreation(
         {
            endpoint: "https://storage.example.com",
            bucketName: "shared-bucket",
            userId: "actor-a",
         },
         async (lifecycle) => {
            await lifecycle.submitted();
            submitted.resolve();
            await completeProvider.promise;
            lifecycle.settled();
            granting.resolve();
            await completeGrant.promise;
            return "granted";
         }
      );
      await submitted.promise;
      await expect(
         replica.withBucketCreation(
            {
               endpoint: "https://storage.example.com",
               bucketName: "shared-bucket",
               userId: "actor-b",
            },
            loser
         )
      ).rejects.toMatchObject({ kind: "conflict" });
      completeProvider.resolve();
      await granting.promise;
      await expect(
         replica.withBucketCreation(
            {
               endpoint: "https://storage.example.com",
               bucketName: "shared-bucket",
               userId: "actor-b",
            },
            loser
         )
      ).rejects.toMatchObject({ kind: "conflict" });
      expect(loser).not.toHaveBeenCalled();
      completeGrant.resolve();
      await expect(winner).resolves.toBe("granted");
      expect(state.store.rows.size).toBe(0);
   });

   it("tells only the requester that a creation is in flight", async () => {
      const finish = Promise.withResolvers<void>();
      const claim = (userId: string, create = vi.fn()) =>
         withBucketCreation(
            {
               endpoint: "https://storage.example.com",
               bucketName: "pending-bucket",
               userId,
            },
            create
         );
      const running = claim(
         "owner",
         vi.fn(() => finish.promise)
      );
      await vi.waitFor(() => expect(state.store.rows.size).toBe(1));
      await expect(claim("owner")).rejects.toMatchObject({
         kind: "conflict",
         message: expect.stringMatching(/active or unresolved creation/),
      });
      await expect(claim("stranger")).rejects.toMatchObject({
         kind: "conflict",
         message: "pending-bucket already exists",
      });
      finish.resolve();
      await running;
   });

   it.each([false, true])(
      "releases failed requests only when provider work is known settled: submitted=%s",
      async (submitted) => {
         await expect(
            withBucketCreation(
               {
                  endpoint: "https://storage.example.com",
                  bucketName: "bucket",
                  userId: "actor",
               },
               async (lifecycle) => {
                  if (submitted) {
                     await lifecycle.submitted();
                     lifecycle.settled();
                  }
                  throw new Error("Known failure");
               }
            )
         ).rejects.toThrow("Known failure");
         expect(state.store.rows.size).toBe(0);
      }
   );

   it("retains an unknown result across retries and replicas until it ages out", async () => {
      await expect(
         withBucketCreation(
            {
               endpoint: "https://storage.example.com",
               bucketName: "bucket",
               userId: "actor",
            },
            async (lifecycle) => {
               await lifecycle.submitted();
               throw new Error("Response lost; storage may still commit");
            }
         )
      ).rejects.toThrow("Response lost");
      expect(
         state.store.rows.get("endpoint:https://storage.example.com/bucket")
            ?.submitted
      ).toBe(true);
      vi.resetModules();
      const replica = await import("./bucket-creation-coordination");
      const row = state.store.rows.get(
         "endpoint:https://storage.example.com/bucket"
      )!;
      const takeOver = vi.fn(async () => "taken over");
      const retry = () =>
         replica.withBucketCreation(
            {
               endpoint: "https://storage.example.com",
               bucketName: "bucket",
               userId: "another",
            },
            takeOver
         );
      row.createdAt = new Date(Date.now() - 14 * 60_000);
      await expect(retry()).rejects.toMatchObject({ kind: "conflict" });
      expect(takeOver).not.toHaveBeenCalled();
      expect(state.store.rows.size).toBe(1);

      row.createdAt = new Date(Date.now() - 16 * 60_000);
      await expect(retry()).resolves.toBe("taken over");
      expect(state.store.rows.size).toBe(0);
   });

   it("does not let an aged-out request release the claim that replaced it", async () => {
      const lost = Promise.withResolvers<void>();
      const stale = withBucketCreation(
         {
            endpoint: "https://storage.example.com",
            bucketName: "bucket",
            userId: "actor",
         },
         () => lost.promise
      );
      await vi.waitFor(() => expect(state.store.rows.size).toBe(1));
      state.store.rows.get(
         "endpoint:https://storage.example.com/bucket"
      )!.createdAt = new Date(Date.now() - 16 * 60_000);
      await expect(
         withBucketCreation(
            {
               endpoint: "https://storage.example.com",
               bucketName: "bucket",
               userId: "another",
            },
            async (lifecycle) => {
               await lifecycle.submitted();
               throw new Error("Lost response");
            }
         )
      ).rejects.toThrow("Lost response");
      lost.resolve();
      await stale;
      expect(
         state.store.rows.get("endpoint:https://storage.example.com/bucket")
            ?.userId
      ).toBe("another");
   });

   it("bounds unresolved claims per actor, sparing another actor and returning once they age out", async () => {
      const create = (bucketName: string) =>
         withBucketCreation(
            {
               endpoint: "https://storage.example.com",
               bucketName,
               userId: "actor",
            },
            async (lifecycle) => {
               await lifecycle.submitted();
               throw new Error("Lost response");
            }
         );
      for (let index = 0; index < 20; index++) {
         await expect(create(`bucket-${index}`)).rejects.toThrow(
            "Lost response"
         );
      }
      await expect(create("overflow")).rejects.toMatchObject({
         kind: "unavailable",
      });
      await expect(
         withBucketCreation(
            {
               endpoint: "https://storage.example.com",
               bucketName: "other",
               userId: "another",
            },
            async () => "created"
         )
      ).resolves.toBe("created");
      for (const row of state.store.rows.values())
         row.createdAt = new Date(Date.now() - 16 * 60_000);
      await expect(create("overflow")).rejects.toThrow("Lost response");
      expect([...state.store.rows.keys()]).toEqual([
         "endpoint:https://storage.example.com/overflow",
      ]);
   });

   it("caps unresolved claims per storage namespace so one endpoint cannot starve another", async () => {
      const namespace = "endpoint:https://evil.example";
      for (let index = 0; index < 1_000; index++) {
         state.store.rows.set(`${namespace}/bucket-${index}`, {
            namespace,
            bucketName: `bucket-${index}`,
            operation: `operation-${index}`,
            userId: `attacker-${index}`,
            submitted: true,
            createdAt: new Date(),
         });
      }
      await expect(
         withBucketCreation(
            {
               endpoint: "https://evil.example",
               bucketName: "overflow",
               userId: "owner",
            },
            vi.fn()
         )
      ).rejects.toMatchObject({ kind: "unavailable" });
      await expect(
         withBucketCreation(
            {
               endpoint: "https://storage.example.com",
               bucketName: "reports",
               userId: "owner",
            },
            async () => "created"
         )
      ).resolves.toBe("created");
   });
});

describe("bucket creation namespaces", () => {
   it.each([
      "https://s3.amazonaws.com",
      "https://s3.us-east-1.amazonaws.com",
      "https://s3-us-west-2.amazonaws.com",
      "https://S3.DUALSTACK.EU-WEST-1.AMAZONAWS.COM.:443/",
   ])("shares AWS's region-independent bucket namespace for %s", (endpoint) => {
      expect(bucketCreationNamespace(endpoint)).toBe("aws");
   });
   it("isolates AWS partitions and user-controlled origins", () => {
      expect(
         bucketCreationNamespace("https://s3.cn-north-1.amazonaws.com.cn")
      ).toBe("aws-cn");
      expect(
         bucketCreationNamespace(
            "https://s3-fips.dualstack.us-gov-west-1.amazonaws.com"
         )
      ).toBe("aws-us-gov");
      for (const endpoint of [
         "https://s3.amazonaws.com.evil.example",
         "https://api.execute-api.us-east-1.amazonaws.com",
         "https://s3.amazonaws.com@evil.example",
      ]) {
         expect(bucketCreationNamespace(endpoint)).toMatch(/^endpoint:/);
      }
      expect(
         bucketCreationNamespace("https://STORAGE.EXAMPLE.COM.:443/prefix")
      ).toBe("endpoint:https://storage.example.com");
   });
   it("lets unrelated providers create the same name while another provider's result is unknown", async () => {
      await expect(
         withBucketCreation(
            {
               endpoint: "https://evil.example",
               bucketName: "desired",
               userId: "attacker",
            },
            async (lifecycle) => {
               await lifecycle.submitted();
               throw new Error("Unresolved");
            }
         )
      ).rejects.toThrow("Unresolved");
      await expect(
         withBucketCreation(
            {
               endpoint: "https://s3.us-east-1.amazonaws.com",
               bucketName: "desired",
               userId: "owner",
            },
            async () => "created"
         )
      ).resolves.toBe("created");
   });
});

describe("the bucket creation lock", () => {
   it("serialises one user's requests, not every tenant's", async () => {
      state.lock.mockClear();
      await withBucketCreation(
         {
            endpoint: "https://storage.example.com",
            bucketName: "own-bucket",
            userId: "actor-a",
         },
         async () => "created"
      );
      expect(state.lock).toHaveBeenCalledExactlyOnceWith(
         expect.anything(),
         LOCK_NAMESPACE.BUCKET_CREATION,
         `user:actor-a`
      );
   });
});
