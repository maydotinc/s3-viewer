import { Prisma } from "@prisma/client";
import type { AuditDetail, AuditEntry } from "@s3-viewer/shared";
import { createHmac } from "node:crypto";

const MAX_TEXT = 1024;

type ChainLink = { seq: number; hash: string };
type Queued = { actor: { id: string; email: string }; entry: AuditEntry };

const chainSelect = {
   serverId: true,
   seq: true,
   actorId: true,
   actorEmail: true,
   action: true,
   bucket: true,
   target: true,
   detail: true,
   prevHash: true,
   hash: true,
   createdAt: true,
} satisfies Prisma.AuditLogSelect;

type ChainRow = Prisma.AuditLogGetPayload<{ select: typeof chainSelect }>;
type Content = Omit<ChainRow, "hash" | "detail"> & { detail: unknown };

let chainKey: Buffer | null = null;

const setAuditChainKey = (key: Buffer): void => {
   chainKey = key;
};

const hashOf = (content: string): string => {
   if (!chainKey) throw new Error("Audit chain key is not set");
   return createHmac("sha256", chainKey).update(content).digest("hex");
};

const databaseText = (value: string): string =>
   value.replaceAll("\0", "\uFFFD").toWellFormed();

const clip = (value: string | null | undefined): string | null =>
   value == null ? null : databaseText(value.slice(0, MAX_TEXT));

const clipDetail = (detail: AuditDetail | null | undefined) =>
   detail
      ? Object.fromEntries(
           Object.entries(detail).map(([key, value]) => [
              databaseText(key),
              typeof value === "string" ? clip(value) : value,
           ])
        )
      : undefined;

// jsonb does not keep key order, so the hash covers a key-sorted form.
const detailText = (detail: unknown): string | null => {
   if (detail == null) return null;
   const record = detail as Record<string, unknown>;
   return JSON.stringify(
      Object.fromEntries(
         Object.keys(record)
            .sort()
            .map((key) => [key, record[key]])
      )
   );
};

const contentOf = (row: Content): string =>
   JSON.stringify([
      row.serverId,
      row.seq,
      row.actorId,
      row.actorEmail,
      row.action,
      row.bucket,
      row.target,
      detailText(row.detail),
      row.createdAt.toISOString(),
      row.prevHash,
   ]);

const auditRow = (
   serverId: string,
   { actor, entry }: Queued,
   previous: ChainLink,
   createdAt: Date
): Prisma.AuditLogCreateManyInput => {
   const row = {
      serverId,
      seq: previous.seq + 1,
      actorId: databaseText(actor.id),
      actorEmail: databaseText(actor.email),
      action: entry.action,
      bucket: clip(entry.bucket),
      target: clip(entry.target),
      detail: clipDetail(entry.detail),
      prevHash: previous.hash,
      createdAt,
   };
   return { ...row, hash: hashOf(contentOf(row)) };
};

export { auditRow, chainSelect, contentOf, hashOf, setAuditChainKey };
export type { ChainLink, ChainRow, Queued };
