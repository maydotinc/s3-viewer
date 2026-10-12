import { prisma } from "@s3-viewer/db";
import express from "express";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { setAuditChainKey } from "../audit/chain";
import { flushAudits } from "../audit/writer";
import { errorHandler } from "../http";
import { serverCrudRouter } from "../../routes/servers/servers";
import {
   assertDisposableDatabase,
   integrationUrl,
   isDisposableDatabase,
   seedUsers,
} from "./integration";
import { testServers } from "./test-server";

const run = randomUUID().replaceAll("-", "");
const ownerId = `${run}owner`;
const actorId = `${run}actor`;
const serverId = `${run}server`;

describe.skipIf(!integrationUrl)(
   "server rename with PostgreSQL row locks",
   () => {
      const serve = testServers("suite");
      let url: string;

      beforeAll(async () => {
         assertDisposableDatabase("Rename tests");
         await seedUsers([ownerId, actorId]);
         await prisma.server.create({
            data: {
               id: serverId,
               name: "Original",
               ownerId,
               provider: "S3",
               credentials: "unused-fixture",
               auditEnabled: true,
               serverAccess: {
                  create: [
                     { userId: ownerId, role: "OWNER" },
                     { userId: actorId, role: "ADMIN" },
                  ],
               },
            },
         });
         const actor = await prisma.user.findUniqueOrThrow({
            where: { id: actorId },
         });
         setAuditChainKey(Buffer.from("disposable-rename-test-key"));
         const app = express();
         app.use(express.json());
         app.use((req, _res, next) => {
            req.user = actor;
            next();
         });
         app.use("/servers", serverCrudRouter);
         app.use(errorHandler);
         url = `${(await serve(app)).origin}/servers/${serverId}`;
      });

      afterAll(async () => {
         if (!isDisposableDatabase()) return;
         try {
            await flushAudits();
            await prisma.auditLog.deleteMany({ where: { serverId } });
            await prisma.auditChainHead.deleteMany({ where: { serverId } });
            await prisma.user.deleteMany({
               where: { id: { in: [ownerId, actorId] } },
            });
         } finally {
            await prisma.$disconnect();
         }
      });

      const rename = (serverName: string) =>
         fetch(url, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ serverName }),
         });

      const waitForBlockedRenames = (count: number) =>
         vi.waitFor(
            async () => {
               const [row] = await prisma.$queryRaw<{ count: number }[]>`
         SELECT count(*)::int AS count FROM pg_stat_activity
         WHERE datname = current_database() AND wait_event_type = 'Lock'
           AND query LIKE '%SELECT "name", "auditEnabled", "auditLevel"%'
      `;
               expect(row!.count).toBeGreaterThanOrEqual(count);
            },
            { timeout: 5000, interval: 25 }
         );

      it("records a connected sequence of previous names for overlapping requests", async () => {
         let pending: Promise<Response[]> | undefined;
         try {
            await prisma.$transaction(
               async (tx) => {
                  await tx.$queryRaw`SELECT "id" FROM "server" WHERE "id" = ${serverId} FOR UPDATE`;
                  pending = Promise.all([rename("First"), rename("Second")]);
                  void pending.catch(() => {});
                  await waitForBlockedRenames(2);
               },
               { timeout: 10_000 }
            );
         } finally {
            await pending;
         }
         expect((await pending)?.map((response) => response.status)).toEqual([
            200, 200,
         ]);
         const entries = await prisma.auditLog.findMany({
            where: { serverId, action: "server.rename" },
         });
         expect(entries).toHaveLength(2);
         const first = entries.find(
            (entry) => (entry.detail as { from: string }).from === "Original"
         );
         expect(first).toBeDefined();
         const second = entries.find((entry) => entry.id !== first!.id)!;
         expect(second.detail).toEqual({ from: first!.target });
         expect(
            await prisma.server.findUnique({ where: { id: serverId } })
         ).toMatchObject({ name: second.target });
      });

      it("refuses a rename after an administrator is downgraded while waiting for the lock", async () => {
         const previous = await prisma.server.findUniqueOrThrow({
            where: { id: serverId },
         });
         const auditCount = await prisma.auditLog.count({
            where: { serverId, action: "server.rename" },
         });
         let pending: Promise<Response> | undefined;
         try {
            await prisma.$transaction(
               async (tx) => {
                  await tx.$queryRaw`SELECT "id" FROM "server" WHERE "id" = ${serverId} FOR UPDATE`;
                  await tx.serverAccess.update({
                     where: { userId_serverId: { userId: actorId, serverId } },
                     data: { role: "VIEWER" },
                  });
                  pending = rename("Must not be applied");
                  void pending.catch(() => {});
                  await waitForBlockedRenames(1);
               },
               { timeout: 10_000 }
            );
         } finally {
            await pending;
         }
         expect((await pending)?.status).toBe(403);
         const saved = await prisma.server.findUniqueOrThrow({
            where: { id: serverId },
         });
         expect(saved.name).toBe(previous.name);
         expect(
            await prisma.auditLog.count({
               where: { serverId, action: "server.rename" },
            })
         ).toBe(auditCount);
      });
   }
);
