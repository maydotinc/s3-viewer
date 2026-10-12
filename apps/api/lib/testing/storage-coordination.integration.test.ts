import { S3Client } from "@aws-sdk/client-s3";
import { Prisma } from "@prisma/client";
import { prisma } from "@s3-viewer/db";
import { Provider } from "@s3-viewer/types";
import { randomBytes, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import {
   afterAll,
   afterEach,
   beforeAll,
   describe,
   expect,
   it,
   vi,
} from "vitest";
import {
   createArchiveTicket,
   readArchiveTicket,
   takeArchiveTicket,
} from "../s3/archive/ticket";
import { createNewBucket } from "../s3/bucket-create";
import { withBucketCreation } from "../s3/bucket-creation-coordination";
import {
   assertDisposableDatabase,
   forkWorker,
   integrationUrl,
   isDisposableDatabase,
} from "./integration";

const isolated = vi.hoisted(() => ({
   schema: `storage_integration_${process.pid}_${Math.random().toString(16).slice(2)}`,
   databaseUrl: "",
}));
vi.mock("@s3-viewer/db", async () => {
   const { PrismaClient } = await import("@prisma/client");
   const url = new URL(process.env.DATABASE_URL!);
   url.searchParams.set("schema", isolated.schema);
   url.searchParams.set("application_name", isolated.schema);
   isolated.databaseUrl = url.toString();
   return { prisma: new PrismaClient({ datasourceUrl: isolated.databaseUrl }) };
});

const run = `storage-integration-${randomUUID()}`;
const userId = `${run}-actor`;
const binding = { userId, serverId: run, bucket: `${run}-bucket` };
const worker = (message: {
   mode: "ticket-create" | "ticket-take" | "bucket";
   token?: string;
   userId: string;
   serverId: string;
   bucket: string;
}): Promise<{ status: number; result?: unknown }> =>
   new Promise((resolve, reject) => {
      const { child, output } = forkWorker(
         new URL("./storage-coordination-worker.ts", import.meta.url),
         [],
         {
            timeout: 30_000,
            env: { ...process.env, DATABASE_URL: isolated.databaseUrl },
         }
      );
      let result: { status: number; result?: unknown } | undefined;
      child.on(
         "message",
         (reply: { ready?: boolean; status: number; result?: unknown }) => {
            if (reply.ready) child.send(message);
            else result = reply;
         }
      );
      child.once("error", reject);
      child.once("exit", (code) => {
         if (code === 0 && result) resolve(result);
         else reject(new Error(`Storage worker failed (${code}): ${output()}`));
      });
   });
describe.skipIf(!integrationUrl)(
   "disposable PostgreSQL storage coordination",
   () => {
      beforeAll(async () => {
         assertDisposableDatabase("Storage integration checks");
         await prisma.$connect();
         const schema = Prisma.raw(`"${isolated.schema}"`);
         await prisma.$executeRaw`CREATE SCHEMA ${schema}`;
         await prisma.$executeRaw`CREATE TABLE ${schema}."archive_ticket" (LIKE public."archive_ticket" INCLUDING ALL)`;
         await prisma.$executeRaw`CREATE TABLE ${schema}."bucket_creation" (LIKE public."bucket_creation" INCLUDING ALL)`;
         const [session] = await prisma.$queryRaw<{ name: string }[]>`
            SELECT current_setting('application_name') AS name
         `;
         expect(session?.name).toBe(isolated.schema);
      });
      afterEach(async () => {
         vi.useRealTimers();
         if (!isDisposableDatabase()) return;
         await prisma.archiveTicket.deleteMany({
            where: { serverId: { startsWith: run } },
         });
         await prisma.bucketCreation.deleteMany({
            where: { userId: { startsWith: run } },
         });
      });
      afterAll(async () => {
         try {
            if (isDisposableDatabase()) {
               await prisma.$executeRaw`DROP SCHEMA IF EXISTS ${Prisma.raw(`"${isolated.schema}"`)} CASCADE`;
            }
         } finally {
            await prisma.$disconnect();
         }
      });

      it("redeems an oversized selection on another replica and atomically refuses every replay", async () => {
         const objectKeys = Array.from({ length: 200 }, () =>
            randomBytes(48).toString("hex")
         );
         const { token } = await createArchiveTicket({
            ...binding,
            objectKeys,
         });
         const results = await Promise.all(
            Array.from({ length: 4 }, () =>
               worker({ mode: "ticket-take", token, ...binding })
            )
         );
         expect(results.map((result) => result.status).sort()).toEqual([
            200, 404, 404, 404,
         ]);
         await expect(takeArchiveTicket(token, binding)).rejects.toMatchObject({
            status: 404,
         });
      }, 40_000);

      it("keeps expiry and binding checks atomic in a non-UTC database session", async () => {
         vi.useFakeTimers({
            now: new Date("2030-01-01T00:00:00.000Z"),
            toFake: ["Date"],
         });
         const { token, expiresAt } = await createArchiveTicket({
            ...binding,
            objectKeys: ["file"],
         });
         await expect(
            takeArchiveTicket(token, { ...binding, userId: "wrong" })
         ).rejects.toMatchObject({ status: 404 });
         vi.setSystemTime(expiresAt.getTime() - 1);
         await expect(readArchiveTicket(token, binding)).resolves.toBeDefined();
         vi.setSystemTime(expiresAt);
         await expect(readArchiveTicket(token, binding)).rejects.toMatchObject({
            status: 404,
         });
         await expect(takeArchiveTicket(token, binding)).rejects.toMatchObject({
            status: 404,
         });
         await createArchiveTicket({ ...binding, objectKeys: ["new"] });
         expect(
            await prisma.archiveTicket.count({ where: { serverId: run } })
         ).toBe(1);
      });

      it("enforces the shared count under concurrent replica admissions and releases consumed capacity", async () => {
         await prisma.archiveTicket.createMany({
            data: Array.from({ length: 999 }, (_, index) => ({
               id: `${run}-${index}`,
               userId: `${run}-${index}`,
               // spread across servers so only the shared pool cap is in play
               serverId: `${run}-pool-${index % 10}`,
               bucket: "bucket",
               payload: { objectKeys: ["file"], sizes: null },
               bytes: 100,
               expiresAt: new Date(Date.now() + 60_000),
            })),
         });
         const outcomes = await Promise.all(
            Array.from({ length: 4 }, (_, index) =>
               worker({
                  mode: "ticket-create",
                  ...binding,
                  userId: `${run}-new-${index}`,
               })
            )
         );
         expect(outcomes.filter(({ status }) => status === 200)).toHaveLength(
            1
         );
         expect(outcomes.filter(({ status }) => status === 503)).toHaveLength(
            3
         );
         await prisma.archiveTicket.deleteMany({ where: { id: `${run}-0` } });
         await expect(
            createArchiveTicket({ ...binding, objectKeys: ["file"] })
         ).resolves.toBeDefined();
      }, 40_000);

      it("keeps a bucket claim across HEAD/create and the winning grant without an open provider transaction", async () => {
         const head = Promise.withResolvers<void>();
         const finishCreate = Promise.withResolvers<void>();
         const granting = Promise.withResolvers<void>();
         const finishGrant = Promise.withResolvers<void>();
         const methods: string[] = [];
         const client = new S3Client({
            region: "us-east-1",
            endpoint: "https://storage.example.com",
            forcePathStyle: true,
            credentials: { accessKeyId: "key", secretAccessKey: "secret" },
            requestHandler: {
               handle: async (request: { method: string }) => {
                  methods.push(request.method);
                  if (request.method === "PUT") {
                     head.resolve();
                     await finishCreate.promise;
                  }
                  const [active] = await prisma.$queryRaw<{ count: number }[]>`
               SELECT count(*)::int AS count FROM pg_stat_activity
               WHERE datname = current_database() AND state = 'idle in transaction'
                  AND application_name = ${isolated.schema}
            `;
                  expect(active?.count).toBe(0);
                  return {
                     response: {
                        statusCode: request.method === "HEAD" ? 404 : 200,
                        headers: {},
                        body: Readable.from([]),
                     },
                  };
               },
            },
         });
         let grants = 0;
         const winner = withBucketCreation(
            {
               endpoint: "https://storage.example.com",
               bucketName: binding.bucket,
               userId,
            },
            async (lifecycle) => {
               await createNewBucket(
                  client,
                  Provider.S3,
                  binding.bucket,
                  new AbortController().signal,
                  lifecycle
               );
               granting.resolve();
               await finishGrant.promise;
               grants++;
            }
         );
         try {
            await Promise.race([head.promise, winner]);
            expect(
               await worker({
                  mode: "bucket",
                  ...binding,
                  userId: `${run}-other`,
               })
            ).toMatchObject({ status: 409 });
            finishCreate.resolve();
            await Promise.race([granting.promise, winner]);
            expect(
               await worker({
                  mode: "bucket",
                  ...binding,
                  userId: `${run}-other`,
               })
            ).toMatchObject({ status: 409 });
         } finally {
            finishCreate.resolve();
            finishGrant.resolve();
            try {
               await winner;
            } finally {
               client.destroy();
            }
         }
         expect(methods).toEqual(["HEAD", "PUT"]);
         expect(grants).toBe(1);
         expect(
            await prisma.bucketCreation.count({
               where: { bucketName: binding.bucket },
            })
         ).toBe(0);
      }, 40_000);

      it("releases pre-submit failures and lets another replica take over an unknown result only after it ages out", async () => {
         await expect(
            withBucketCreation(
               {
                  endpoint: "https://storage.example.com",
                  bucketName: binding.bucket,
                  userId,
               },
               async () => {
                  throw new Error("HEAD failed");
               }
            )
         ).rejects.toThrow("HEAD failed");
         expect(
            await prisma.bucketCreation.count({
               where: { bucketName: binding.bucket },
            })
         ).toBe(0);
         await expect(
            withBucketCreation(
               {
                  endpoint: "https://storage.example.com",
                  bucketName: binding.bucket,
                  userId,
               },
               async (lifecycle) => {
                  await lifecycle.submitted();
                  throw new Error("Response lost");
               }
            )
         ).rejects.toThrow("Response lost");
         const age = (minutes: number) =>
            prisma.bucketCreation.update({
               where: {
                  namespace_bucketName: {
                     namespace: "endpoint:https://storage.example.com",
                     bucketName: binding.bucket,
                  },
               },
               data: { createdAt: new Date(Date.now() - minutes * 60_000) },
            });
         await age(14);
         expect(
            await worker({ mode: "bucket", ...binding, userId: `${run}-other` })
         ).toMatchObject({ status: 409 });
         await age(16);
         expect(
            await worker({ mode: "bucket", ...binding, userId: `${run}-other` })
         ).toMatchObject({ status: 200, result: "created-and-granted" });
      }, 40_000);
   }
);
