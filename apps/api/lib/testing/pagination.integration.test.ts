import { prisma } from "@s3-viewer/db";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@s3-viewer/types";
import { decodeCursor } from "../cursor";
import { receivedInvitePage, sentInvitePage } from "../services/invites";
import { listMembers } from "../services/members";
import {
   assertDisposableDatabase,
   integrationUrl,
   isDisposableDatabase,
   seedUsers,
} from "./integration";

const run = randomUUID().replaceAll("-", "");
const userIds = [0, 1, 2].map((n) => `${run}u${n}`);
const serverIds = [0, 1, 2].map((n) => `${run}s${n}`);
const at = new Date("2026-01-01T00:00:00Z");
const recipient = `${run}@example.com`;

describe.skipIf(!integrationUrl)("database pagination", () => {
   beforeAll(async () => {
      assertDisposableDatabase("Pagination tests");
      await seedUsers(userIds);
      await prisma.server.createMany({
         data: serverIds.map((id) => ({
            id,
            name: id,
            ownerId: userIds[0]!,
            credentials: "test",
         })),
      });
      await prisma.serverAccess.createMany({
         data: userIds.map((userId, n) => ({
            id: `${run}m${n}`,
            userId,
            serverId: serverIds[0]!,
            role: "EDITOR",
            createdAt: at,
         })),
      });
      await prisma.bucketAccess.createMany({
         data: [
            {
               userId: userIds[0]!,
               serverId: serverIds[0]!,
               bucketName: "z-last",
               role: "VIEWER",
            },
            {
               userId: userIds[0]!,
               serverId: serverIds[0]!,
               bucketName: "a-first",
               role: "EDITOR",
            },
            {
               userId: userIds[0]!,
               serverId: serverIds[1]!,
               bucketName: "must-not-leak",
               role: "OWNER",
            },
         ],
      });
      await prisma.pendingInvitation.createMany({
         data: serverIds.map((serverId, n) => ({
            id: `${run}i${n}`,
            token: `${run}t${n}`,
            serverId,
            invitedById: userIds[0]!,
            email: recipient,
            role: "EDITOR",
            createdAt: at,
            expiresAt: new Date(n === 1 ? "2020-01-01" : "2099-01-01"),
         })),
      });
      await prisma.invitationBucketAccess.createMany({
         data: [
            { invitationId: `${run}i2`, bucketName: "z-last", role: "VIEWER" },
            { invitationId: `${run}i2`, bucketName: "a-first", role: "EDITOR" },
            {
               invitationId: `${run}i1`,
               bucketName: "must-not-leak",
               role: "ADMIN",
            },
         ],
      });
   });

   afterAll(async () => {
      if (!isDisposableDatabase()) return;
      await prisma.server.deleteMany({ where: { id: { in: serverIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.$disconnect();
   });

   it("pages equal-timestamp members with only their own server grants", async () => {
      const owner = { id: userIds[0]!, role: Role.OWNER };
      const first = await listMembers(serverIds[0]!, undefined, 2, owner);
      expect(first.members.map((member) => member.id)).toEqual(
         userIds.slice(0, 2)
      );
      expect(first.members[0]!.bucketAccess).toEqual([
         { bucketName: "a-first", role: "EDITOR", folders: null },
         { bucketName: "z-last", role: "VIEWER", folders: null },
      ]);
      expect(first.members[1]!.bucketAccess).toEqual([]);
      expect(first.nextCursor).not.toBeNull();
      await prisma.serverAccess.delete({ where: { id: `${run}m1` } });
      const second = await listMembers(
         serverIds[0]!,
         first.nextCursor!,
         2,
         owner
      );
      expect(second.members.map((member) => member.id)).toEqual([userIds[2]]);
      expect(second.nextCursor).toBeNull();
      expect(
         (await listMembers(serverIds[1]!, undefined, 2, owner)).members
      ).toEqual([]);
   });

   it("seeks recipient invitations past ties and expired rows without mixing grants", async () => {
      const first = await receivedInvitePage(
         recipient.toUpperCase(),
         undefined,
         1
      );
      expect(first.map((row) => row.id)).toEqual([`${run}i2`]);
      const wholeBucket = { restrictedFolders: false, allowedFolders: [] };
      expect(first[0]!.bucketAccess).toEqual([
         { bucketName: "a-first", role: "EDITOR", ...wholeBucket },
         { bucketName: "z-last", role: "VIEWER", ...wholeBucket },
      ]);
      expect(first[0]!.server.id).toBe(serverIds[2]);
      expect(first[0]!.invitedBy.email).toBe(`${userIds[0]}@example.com`);
      const cursor = decodeCursor(
         Buffer.from(`${at.toISOString()}|${run}i2`).toString("base64url")
      );
      await prisma.pendingInvitation.delete({ where: { id: `${run}i2` } });
      const second = await receivedInvitePage(recipient, cursor, 5);
      expect(second.map((row) => row.id)).toEqual([`${run}i0`]);
      expect(second[0]!.bucketAccess).toEqual([]);
      expect(
         await receivedInvitePage("someone-else@example.com", undefined, 5)
      ).toEqual([]);
   });

   it("seeks a sender's live invitations only on servers they still manage", async () => {
      const sender = userIds[0]!;
      const managing = [Role.OWNER, Role.ADMIN];
      expect(await sentInvitePage(sender, managing, undefined, 5)).toEqual([]);
      await prisma.serverAccess.update({
         where: { id: `${run}m0` },
         data: { role: "ADMIN" },
      });
      const first = await sentInvitePage(sender, managing, undefined, 5);
      expect(first.map((row) => row.id)).toEqual([`${run}i0`]);
      expect(first[0]!.server.id).toBe(serverIds[0]);
      const after = (id: string) =>
         decodeCursor(
            Buffer.from(`${at.toISOString()}|${id}`).toString("base64url")
         );
      expect(
         (await sentInvitePage(sender, managing, after(`${run}i9`), 5)).map(
            (row) => row.id
         )
      ).toEqual([`${run}i0`]);
      expect(
         await sentInvitePage(sender, managing, after(`${run}i0`), 5)
      ).toEqual([]);
   });
});
