import { prisma } from "@s3-viewer/db";
import { Permission } from "@s3-viewer/permissions";
import { Role } from "@s3-viewer/types";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listAuditPage } from "../audit/query";
import {
   authorizeAudit,
   authorizeBucket,
   getAuditContext,
} from "../middleware/authorize";
import { bucketGrantSelect } from "../services/bucket-grants";
import { revokeInvalidInvites } from "../services/invite-authority";
import { grantBucketRoles, receivedInvitePage } from "../services/invites";
import { listMembers, replaceBucketAccess } from "../services/members";
import {
   assertDisposableDatabase,
   integrationUrl,
   isDisposableDatabase,
   seedUsers,
} from "./integration";

const run = randomUUID().replaceAll("-", "");
const owner = `${run}u0`;
const contractor = `${run}u1`;
const admin = `${run}u2`;
const serverId = `${run}s0`;
const recipient = `${run}@example.com`;
const BUCKET = "company";

const grantOf = (userId: string, bucketName = BUCKET) =>
   prisma.bucketAccess.findUnique({
      where: { userId_serverId_bucketName: { userId, serverId, bucketName } },
      select: bucketGrantSelect,
   });

describe.skipIf(!integrationUrl)("folder access in PostgreSQL", () => {
   beforeAll(async () => {
      assertDisposableDatabase("Folder access tests");
      await seedUsers([owner, contractor, admin]);
      await prisma.server.create({
         data: {
            id: serverId,
            name: serverId,
            ownerId: owner,
            credentials: "test",
            auditEnabled: true,
            auditViewRole: "VIEWER",
         },
      });
      await prisma.serverAccess.createMany({
         data: [
            { userId: owner, serverId, role: "OWNER" },
            { userId: contractor, serverId, role: "EDITOR" },
            { userId: admin, serverId, role: "ADMIN" },
         ],
      });
      await prisma.bucketAccess.createMany({
         data: [
            {
               userId: contractor,
               serverId,
               bucketName: BUCKET,
               role: "EDITOR",
               restrictedFolders: true,
               allowedFolders: ["landing/"],
            },
            {
               userId: contractor,
               serverId,
               bucketName: "open",
               role: "VIEWER",
            },
            {
               userId: admin,
               serverId,
               bucketName: BUCKET,
               role: "EDITOR",
               restrictedFolders: true,
               allowedFolders: ["landing/", "blog/"],
            },
         ],
      });
   });

   afterAll(async () => {
      if (!isDisposableDatabase()) return;
      await prisma.auditLog.deleteMany({ where: { serverId } });
      await prisma.server.deleteMany({ where: { id: serverId } });
      await prisma.user.deleteMany({
         where: { id: { in: [owner, contractor, admin] } },
      });
      await prisma.$disconnect();
   });

   it.each([
      [
         "a limited admin grant",
         { role: "ADMIN", restrictedFolders: true, allowedFolders: ["a/"] },
      ],
      [
         "a limited grant naming no folders",
         { role: "EDITOR", restrictedFolders: true, allowedFolders: [] },
      ],
      [
         "folders on a whole-bucket grant",
         { role: "EDITOR", restrictedFolders: false, allowedFolders: ["a/"] },
      ],
   ] as const)("refuses to store %s", async (_what, columns) => {
      await expect(
         prisma.bucketAccess.create({
            data: {
               userId: owner,
               serverId,
               bucketName: "rejected",
               ...columns,
               allowedFolders: [...columns.allowedFolders],
            },
         })
      ).rejects.toThrow();
      await prisma.pendingInvitation.create({
         data: {
            id: `${run}bad`,
            token: `${run}badtoken`,
            serverId,
            invitedById: owner,
            email: `bad-${recipient}`,
            role: "EDITOR",
            expiresAt: new Date("2099-01-01"),
         },
      });
      try {
         await expect(
            prisma.invitationBucketAccess.create({
               data: {
                  invitationId: `${run}bad`,
                  bucketName: "rejected",
                  ...columns,
                  allowedFolders: [...columns.allowedFolders],
               },
            })
         ).rejects.toThrow();
      } finally {
         await prisma.pendingInvitation.delete({ where: { id: `${run}bad` } });
      }
   });

   it("refuses to store an empty folder name, which every key would match", async () => {
      await expect(
         prisma.bucketAccess.create({
            data: {
               userId: owner,
               serverId,
               bucketName: "rejected",
               role: "VIEWER",
               restrictedFolders: true,
               allowedFolders: ["landing/", ""],
            },
         })
      ).rejects.toThrow();
   });

   it("refuses to promote a limited grant to admin in place", async () => {
      await expect(
         prisma.bucketAccess.updateMany({
            where: { userId: contractor, serverId, bucketName: BUCKET },
            data: { role: "ADMIN" },
         })
      ).rejects.toThrow();
   });

   it("authorizes with the folders stored on the grant", async () => {
      const limited = await authorizeBucket(
         contractor,
         serverId,
         BUCKET,
         Permission.UPLOAD_OBJECT
      );
      expect(limited.folders).toEqual(["landing/"]);
      const open = await authorizeBucket(
         contractor,
         serverId,
         "open",
         Permission.LIST_OBJECTS
      );
      expect(open.folders).toBeNull();
      const owned = await authorizeBucket(
         owner,
         serverId,
         BUCKET,
         Permission.DELETE_BUCKET
      );
      expect(owned.folders).toBeNull();
   });

   it("lists members with their folders", async () => {
      const { members } = await listMembers(serverId, undefined, 10, {
         id: owner,
         role: Role.OWNER,
      });
      const access = Object.fromEntries(
         members.map((member) => [member.id, member.bucketAccess])
      );
      expect(access[contractor]).toEqual([
         { bucketName: BUCKET, role: "EDITOR", folders: ["landing/"] },
         { bucketName: "open", role: "VIEWER", folders: null },
      ]);
      expect(access[owner]).toEqual([]);
   });

   it("round-trips a replaced grant between limited and whole-bucket", async () => {
      const target = `${run}u3`;
      await prisma.user.create({
         data: {
            id: target,
            email: `${target}@example.com`,
            name: target,
            emailVerified: true,
         },
      });
      try {
         await prisma.serverAccess.create({
            data: { userId: target, serverId, role: "VIEWER" },
         });
         const replace = (folders: string[] | null) =>
            prisma.$transaction((tx) =>
               replaceBucketAccess(
                  tx,
                  target,
                  serverId,
                  [{ bucketName: BUCKET, role: Role.VIEWER, folders }],
                  null
               )
            );
         await replace(["a/", "b/"]);
         expect(await grantOf(target)).toMatchObject({
            restrictedFolders: true,
            allowedFolders: ["a/", "b/"],
         });
         await replace(null);
         expect(await grantOf(target)).toMatchObject({
            restrictedFolders: false,
            allowedFolders: [],
         });
      } finally {
         await prisma.user.delete({ where: { id: target } });
      }
   });

   it("merges an accepted invite without widening a higher role", async () => {
      const accept = (
         role: "VIEWER" | "EDITOR" | "ADMIN",
         folders: string[] | null
      ) =>
         prisma.$transaction((tx) =>
            grantBucketRoles(tx, contractor, serverId, [
               {
                  bucketName: BUCKET,
                  role,
                  restrictedFolders: folders !== null,
                  allowedFolders: folders ?? [],
               },
               {
                  bucketName: "fresh",
                  role: "VIEWER",
                  restrictedFolders: true,
                  allowedFolders: ["only/"],
               },
            ])
         );
      try {
         await accept("VIEWER", null);
         expect(await grantOf(contractor)).toMatchObject({
            role: "EDITOR",
            restrictedFolders: true,
            allowedFolders: ["landing/"],
         });
         expect(await grantOf(contractor, "fresh")).toMatchObject({
            role: "VIEWER",
            allowedFolders: ["only/"],
         });
         await accept("EDITOR", ["blog/"]);
         expect(await grantOf(contractor)).toMatchObject({
            role: "EDITOR",
            allowedFolders: ["blog/", "landing/"],
         });
         await accept("ADMIN", null);
         expect(await grantOf(contractor)).toMatchObject({
            role: "ADMIN",
            restrictedFolders: false,
            allowedFolders: [],
         });
      } finally {
         await prisma.bucketAccess.deleteMany({
            where: { userId: contractor, serverId, bucketName: "fresh" },
         });
         await prisma.bucketAccess.update({
            where: {
               userId_serverId_bucketName: {
                  userId: contractor,
                  serverId,
                  bucketName: BUCKET,
               },
            },
            data: {
               role: "EDITOR",
               restrictedFolders: true,
               allowedFolders: ["landing/"],
            },
         });
      }
   });

   it("revokes a pending invite its sender can no longer cover", async () => {
      const invite = async (id: string, folders: string[] | null) => {
         await prisma.pendingInvitation.create({
            data: {
               id,
               token: `${id}token`,
               serverId,
               invitedById: admin,
               email: `${id}-${recipient}`,
               role: "VIEWER",
               expiresAt: new Date("2099-01-01"),
               bucketAccess: {
                  create: {
                     bucketName: BUCKET,
                     role: "VIEWER",
                     restrictedFolders: folders !== null,
                     allowedFolders: folders ?? [],
                  },
               },
            },
         });
         return id;
      };
      const inside = await invite(`${run}in`, ["landing/img/"]);
      const outside = await invite(`${run}out`, ["private/"]);
      const whole = await invite(`${run}all`, null);
      const partly = await invite(`${run}mix`, ["blog/", "private/"]);
      await prisma.$transaction((tx) => revokeInvalidInvites(tx, serverId));
      const left = await prisma.pendingInvitation.findMany({
         where: { id: { in: [inside, outside, whole, partly] } },
         select: { id: true },
      });
      expect(left.map(({ id }) => id)).toEqual([inside]);

      const [received] = await receivedInvitePage(
         `${inside}-${recipient}`,
         undefined,
         5
      );
      expect(received?.bucketAccess).toEqual([
         {
            bucketName: BUCKET,
            role: "VIEWER",
            restrictedFolders: true,
            allowedFolders: ["landing/img/"],
         },
      ]);
      await prisma.pendingInvitation.deleteMany({ where: { id: inside } });
   });

   it("shows a limited member only their own activity in that bucket", async () => {
      const rows: {
         actorId: string;
         bucket: string | null;
         target: string | null;
         action?: string;
         detail?: Record<string, string>;
      }[] = [
         { actorId: owner, bucket: BUCKET, target: "private/payroll.csv" },
         { actorId: owner, bucket: BUCKET, target: "landing/hero.png" },
         { actorId: contractor, bucket: BUCKET, target: "landing/mine.png" },
         { actorId: owner, bucket: "open", target: "shared.txt" },
         { actorId: owner, bucket: "elsewhere", target: "hidden.txt" },
         { actorId: owner, bucket: null, target: "someone@example.com" },
         {
            actorId: owner,
            bucket: "open",
            target: "inbox/payroll.csv",
            action: "object.transfer",
            detail: {
               fromServerId: serverId,
               fromBucket: BUCKET,
               from: "private/payroll.csv",
            },
         },
         {
            actorId: owner,
            bucket: "open",
            target: "shared.txt",
            action: "object.download",
            detail: { toServerId: serverId, toBucket: "elsewhere" },
         },
         {
            actorId: owner,
            bucket: null,
            target: null,
            action: "server.rename",
            detail: { from: "Old name" },
         },
         {
            actorId: contractor,
            bucket: "open",
            target: "inbox/mine.png",
            action: "object.transfer",
            detail: {
               fromServerId: serverId,
               fromBucket: BUCKET,
               from: "landing/mine.png",
            },
         },
      ];
      await prisma.auditLog.createMany({
         data: rows.map((row, i) => ({
            action: "object.view",
            ...row,
            id: `${run}a${i}`,
            serverId,
            seq: i + 1,
            actorEmail: `${row.actorId}@example.com`,
            prevHash: "",
            hash: `${run}${i}`,
            createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
         })),
      });

      const res = { locals: { input: { serverId } } } as unknown as Response;
      const reachOf = async (userId: string) => {
         await new Promise<void>((resolve, reject) =>
            authorizeAudit("view")(
               { user: { id: userId } } as unknown as Request,
               res,
               (error?: unknown) => (error ? reject(error) : resolve())
            )
         );
         return getAuditContext(res).reach;
      };

      const reach = await reachOf(contractor);
      expect(reach).toEqual({
         buckets: ["open"],
         ownBuckets: [BUCKET],
         actorId: contractor,
         serverWide: false,
      });
      const targets = async (filters: { bucket?: string } = {}) =>
         (
            await listAuditPage({ serverId, reach, limit: 50, ...filters })
         ).entries.map(({ target }) => target);
      expect(await targets()).toEqual([
         "inbox/mine.png",
         "shared.txt",
         "inbox/payroll.csv",
         "shared.txt",
         "landing/mine.png",
      ]);

      const details = Object.fromEntries(
         (
            await listAuditPage({ serverId, reach, limit: 50, bucket: "open" })
         ).entries.map(({ target, detail }) => [target, detail])
      );
      expect(details["inbox/payroll.csv"]).toEqual({});
      expect(
         (
            await listAuditPage({ serverId, reach, limit: 50, bucket: "open" })
         ).entries.find(({ action }) => action === "object.download")?.detail
      ).toEqual({});
      expect(details["inbox/mine.png"]).toMatchObject({
         from: "landing/mine.png",
      });
      const everything = await listAuditPage({
         serverId,
         reach: null,
         limit: 50,
         bucket: "open",
      });
      expect(
         everything.entries.find(({ target }) => target === "inbox/payroll.csv")
            ?.detail
      ).toMatchObject({ from: "private/payroll.csv" });
      expect(await targets({ bucket: BUCKET })).toEqual(["landing/mine.png"]);
      expect(await targets({ bucket: "elsewhere" })).toEqual([]);

      const adminReach = await reachOf(admin);
      expect(adminReach).toMatchObject({
         buckets: [],
         ownBuckets: [BUCKET],
         serverWide: true,
      });
      expect(
         (
            await listAuditPage({ serverId, reach: adminReach, limit: 50 })
         ).entries.map(({ target }) => target)
      ).toEqual([null, "someone@example.com"]);
      expect(
         (
            await listAuditPage({ serverId, reach: adminReach, limit: 50 })
         ).entries.find(({ action }) => action === "server.rename")?.detail
      ).toEqual({ from: "Old name" });

      expect(await reachOf(owner)).toBeNull();
   });
});
