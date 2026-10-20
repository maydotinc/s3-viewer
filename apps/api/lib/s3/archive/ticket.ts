import { LOCK_NAMESPACE, xactLock } from "@/lib/db-locks";
import { ApiHttpError } from "@/lib/http";
import type {
   ArchiveTicket as StoredArchiveTicket,
   Prisma,
} from "@prisma/client";
import { prisma } from "@s3-viewer/db";
import { ARCHIVE_TOKEN_TTL_MS, MIB } from "@s3-viewer/types";
import { createHash, randomBytes } from "node:crypto";
import { archiveFilename, namedFiles, type ManifestEntry } from "./entries";

const MAX_TICKETS_PER_USER = 5;
const MAX_RETAINED_TICKETS = 1_000;
const MAX_RETAINED_TICKET_BYTES = 64 * MIB;
const MAX_TICKET_PAYLOAD_BYTES = 2 * MIB;
// a ticket's manifest is the same order of size as the 1,000 keys a selection may already carry, about 2,000 entries;
// longer listings are re-collected on redemption, behind the zip slot and the collection cap.
const MAX_MANIFEST_BYTES = 256 * 1024;
const MAX_TICKET_FAILURES = 3;
// one server's members, however many accounts they hold, cannot fill the shared pool.
const SERVER_SHARE = 0.2;
const MAX_SERVER_TICKETS = MAX_RETAINED_TICKETS * SERVER_SHARE;
const MAX_SERVER_TICKET_BYTES = MAX_RETAINED_TICKET_BYTES * SERVER_SHARE;

type ArchiveTicket = {
   filename: string;
   target: string;
   objectKeys: string[];
   fileSizes?: ReadonlyMap<string, number>;
   manifest?: ManifestEntry[];
};
type TicketBinding = { userId: string; serverId: string; bucket: string };
type TicketRequest = TicketBinding & {
   objectKeys: readonly string[];
   fileSizes?: ReadonlyMap<string, number>;
   manifest?: readonly ManifestEntry[];
};
type TicketPayload = {
   objectKeys: string[];
   sizes: (number | null)[] | null;
   manifest?: ManifestEntry[];
};

const unavailable = (): ApiHttpError =>
   new ApiHttpError(
      404,
      "This download expired or was already used. Select the files again."
   );
const capacity = (): ApiHttpError =>
   new ApiHttpError(503, "Zip download capacity is busy. Try again shortly.");
const ticketId = (token: string): string => {
   if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw unavailable();
   return createHash("sha256").update(token).digest("hex");
};
const ticketOf = (stored: StoredArchiveTicket): ArchiveTicket => {
   const { objectKeys, sizes, manifest } =
      stored.payload as unknown as TicketPayload;
   return {
      objectKeys,
      manifest,
      fileSizes: sizes
         ? new Map(
              namedFiles(objectKeys).flatMap((key, index) => {
                 const size = sizes[index];
                 return size == null ? [] : [[key, size] as [string, number]];
              })
           )
         : undefined,
      filename: archiveFilename(stored.bucket, objectKeys),
      target: objectKeys[0] ?? stored.bucket,
   };
};

const createArchiveTicket = async (
   request: TicketRequest
): Promise<{ token: string; expiresAt: Date }> => {
   const { userId, serverId, bucket } = request;
   const payload: TicketPayload = {
      objectKeys: [...request.objectKeys],
      sizes: request.fileSizes
         ? namedFiles(request.objectKeys).map(
              (key) => request.fileSizes!.get(key) ?? null
           )
         : null,
   };
   let payloadBytes = Buffer.byteLength(JSON.stringify(payload));
   if (payloadBytes > MAX_TICKET_PAYLOAD_BYTES) throw capacity();
   if (request.manifest) {
      const manifestBytes = Buffer.byteLength(JSON.stringify(request.manifest));
      if (
         manifestBytes <= MAX_MANIFEST_BYTES &&
         payloadBytes + manifestBytes <= MAX_TICKET_PAYLOAD_BYTES
      ) {
         payload.manifest = [...request.manifest];
         payloadBytes += manifestBytes;
      }
   }
   const bytes =
      payloadBytes +
      payload.objectKeys.length * 128 +
      (payload.manifest?.length ?? 0) * 128 +
      (payload.sizes?.length ?? 0) * 128 +
      (userId.length + serverId.length + bucket.length) * 4 +
      512;
   const token = randomBytes(32).toString("base64url");
   const id = ticketId(token);
   return prisma.$transaction(async (tx) => {
      await xactLock(tx, LOCK_NAMESPACE.ARCHIVE_TICKET, 0);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ARCHIVE_TOKEN_TTL_MS);
      await tx.archiveTicket.deleteMany({ where: { expiresAt: { lte: now } } });
      const mine = await tx.archiveTicket.findMany({
         where: { userId },
         select: { id: true, bytes: true },
         orderBy: [{ createdAt: "asc" }, { id: "asc" }],
         take: MAX_TICKETS_PER_USER,
      });
      const oldest = mine.length >= MAX_TICKETS_PER_USER ? mine[0] : undefined;
      if (oldest)
         await tx.archiveTicket.deleteMany({ where: { id: oldest.id } });
      const total = await tx.archiveTicket.aggregate({
         _count: true,
         _sum: { bytes: true },
      });
      const server = await tx.archiveTicket.aggregate({
         where: { serverId },
         _count: true,
         _sum: { bytes: true },
      });
      if (
         total._count >= MAX_RETAINED_TICKETS ||
         bytes > MAX_RETAINED_TICKET_BYTES - (total._sum.bytes ?? 0) ||
         server._count >= MAX_SERVER_TICKETS ||
         bytes > MAX_SERVER_TICKET_BYTES - (server._sum.bytes ?? 0)
      )
         throw capacity();
      await tx.archiveTicket.create({
         data: {
            id,
            userId,
            serverId,
            bucket,
            payload: payload as Prisma.InputJsonObject,
            bytes,
            expiresAt,
         },
      });
      return { token, expiresAt };
   });
};

const readArchiveTicket = async (
   token: string,
   binding: TicketBinding
): Promise<ArchiveTicket> => {
   const ticket = await prisma.archiveTicket.findFirst({
      where: { id: ticketId(token), ...binding, expiresAt: { gt: new Date() } },
   });
   if (!ticket) throw unavailable();
   return ticketOf(ticket);
};

const takeArchiveTicket = async (
   token: string,
   { userId, serverId, bucket }: TicketBinding
): Promise<void> => {
   const id = ticketId(token);
   const taken = await prisma.$queryRaw<{ id: string }[]>`
      DELETE FROM "archive_ticket"
      WHERE "id" = ${id} AND "userId" = ${userId}
         AND "serverId" = ${serverId} AND "bucket" = ${bucket}
         AND "expiresAt" > ${new Date().toISOString()}::timestamp
      RETURNING "id"
   `;
   if (taken.length === 0) throw unavailable();
};

const failArchiveTicket = async (
   token: string,
   binding: TicketBinding
): Promise<void> => {
   const where = { id: ticketId(token), ...binding };
   await prisma.archiveTicket.updateMany({
      where,
      data: { failures: { increment: 1 } },
   });
   await prisma.archiveTicket.deleteMany({
      where: { ...where, failures: { gte: MAX_TICKET_FAILURES } },
   });
};

export {
   createArchiveTicket,
   failArchiveTicket,
   readArchiveTicket,
   takeArchiveTicket,
};
