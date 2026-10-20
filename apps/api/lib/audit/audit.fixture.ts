import { createHmac } from "node:crypto";
import type { Response } from "express";
import { AuditLevel } from "@s3-viewer/types";
import { afterAll, beforeAll, vi, type Mock } from "vitest";

type Stored = {
   serverId: string;
   seq: number;
   actorId: string;
   actorEmail: string;
   action: string;
   bucket: string | null;
   target: string | null;
   detail: Record<string, unknown> | undefined;
   prevHash: string;
   hash: string;
   createdAt: Date;
};

type AuditMocks = Record<
   | "accessFind"
   | "createMany"
   | "findFirst"
   | "findMany"
   | "grantFind"
   | "headFind"
   | "headUpsert"
   | "selectRows"
   | "queryRaw"
   | "transaction"
   | "warn"
   | "error",
   Mock
>;

const NOW = new Date("2026-09-07T12:00:00.000Z");
const KEY = Buffer.from("audit-chain-test-key");

const whole = {
   truncated: false,
   anchorSeq: null,
   nextFromSeq: null,
};

const auditMocks = (): AuditMocks => ({
   accessFind: vi.fn(),
   createMany: vi.fn(),
   findFirst: vi.fn(),
   findMany: vi.fn(),
   grantFind: vi.fn(),
   headFind: vi.fn(),
   headUpsert: vi.fn(),
   selectRows: vi.fn(),
   queryRaw: vi.fn(),
   transaction: vi.fn(),
   warn: vi.fn(),
   error: vi.fn(),
});

const auditDatabase = (h: AuditMocks) => {
   const auditLog = {
      createMany: h.createMany,
      findFirst: h.findFirst,
      findMany: h.findMany,
   };
   const auditChainHead = { findUnique: h.headFind, upsert: h.headUpsert };
   return {
      prisma: {
         auditLog,
         auditChainHead,
         serverAccess: { findMany: h.accessFind },
         bucketAccess: { findMany: h.grantFind },
         $queryRaw: h.selectRows,
         $transaction: (
            work: (tx: unknown) => Promise<unknown>,
            options: unknown
         ) => {
            h.transaction(options);
            return work({
               auditLog,
               auditChainHead,
               $executeRaw: h.queryRaw,
               $queryRaw: h.selectRows,
            });
         },
      },
   };
};

const resetAuditMocks = (h: AuditMocks): void => {
   vi.clearAllMocks();
   h.accessFind.mockResolvedValue([]);
   h.createMany.mockResolvedValue({ count: 1 });
   h.findFirst.mockResolvedValue(null);
   h.findMany.mockResolvedValue([]);
   h.grantFind.mockResolvedValue([]);
   h.headFind.mockResolvedValue(null);
   h.headUpsert.mockResolvedValue({});
   h.selectRows.mockResolvedValue([]);
   h.queryRaw.mockResolvedValue(1);
};

const useAuditClock = (setAuditChainKey: (key: Buffer) => void): void => {
   beforeAll(() => {
      vi.useFakeTimers({
         toFake: ["Date", "setTimeout", "clearTimeout"],
         now: NOW,
      });
      setAuditChainKey(KEY);
   });
   afterAll(() => {
      vi.useRealTimers();
   });
};

const fakeRes = (
   enabled: boolean,
   level: AuditLevel = AuditLevel.ALL
): Response =>
   ({
      locals: {
         auth: {
            userId: "actor12345",
            serverRole: "OWNER",
            audit: { enabled, level },
         },
         input: { serverId: "server12345", bucketName: "photos" },
      },
      req: { user: { id: "actor12345", email: "actor@example.com" } },
   }) as unknown as Response;

const hmac = (content: string, key: Buffer = KEY) =>
   createHmac("sha256", key).update(content).digest("hex");

const storedRows = (h: AuditMocks): Stored[] =>
   h.createMany.mock.calls.flatMap((call) => call[0].data as Stored[]);

const serveChain = (h: AuditMocks, chain: Stored[]) =>
   h.findMany.mockImplementation(
      async ({
         where,
         take,
      }: {
         where: { seq?: { gt: number } };
         take: number;
      }) =>
         chain.filter((r) => !where.seq || r.seq > where.seq.gt).slice(0, take)
   );

export {
   KEY,
   NOW,
   auditDatabase,
   auditMocks,
   fakeRes,
   hmac,
   resetAuditMocks,
   serveChain,
   storedRows,
   useAuditClock,
   whole,
};
export type { Stored };
