import type { ArchiveTicket } from "@prisma/client";
import { serialTransactions } from "./serial-transaction";

type TicketWhere = {
   id?: string;
   userId?: string;
   serverId?: string;
   bucket?: string;
   expiresAt?: { gt?: Date; lte?: Date };
   failures?: { gte: number };
};

const archiveTicketStore = () => {
   let rows = new Map<string, ArchiveTicket>();
   const matches = (row: ArchiveTicket, where: TicketWhere) =>
      Object.entries(where).every(([field, value]) => {
         if (field === "expiresAt") {
            const range = value as NonNullable<TicketWhere["expiresAt"]>;
            return (
               (!range.gt || row.expiresAt > range.gt) &&
               (!range.lte || row.expiresAt <= range.lte)
            );
         }
         if (field === "failures")
            return row.failures >= (value as { gte: number }).gte;
         return row[field as keyof ArchiveTicket] === value;
      });
   const store = {
      reset: () => {
         rows.clear();
      },
      rows: () => [...rows.values()],
      archiveTicket: {
         deleteMany: async ({ where }: { where: TicketWhere }) => {
            let count = 0;
            for (const [id, row] of rows)
               if (matches(row, where)) {
                  rows.delete(id);
                  count++;
               }
            return { count };
         },
         updateMany: async ({
            where,
            data,
         }: {
            where: TicketWhere;
            data: { failures: { increment: number } };
         }) => {
            let count = 0;
            for (const row of rows.values())
               if (matches(row, where)) {
                  row.failures += data.failures.increment;
                  count++;
               }
            return { count };
         },
         findMany: async ({
            where,
            take,
         }: {
            where: TicketWhere;
            take: number;
         }) =>
            [...rows.values()]
               .filter((row) => matches(row, where))
               .sort(
                  (a, b) =>
                     a.createdAt.getTime() - b.createdAt.getTime() ||
                     a.id.localeCompare(b.id)
               )
               .slice(0, take),
         findFirst: async ({ where }: { where: TicketWhere }) =>
            structuredClone(
               [...rows.values()].find((row) => matches(row, where)) ?? null
            ),
         aggregate: async ({ where = {} }: { where?: TicketWhere } = {}) => {
            const matched = [...rows.values()].filter((row) =>
               matches(row, where)
            );
            return {
               _count: matched.length,
               _sum: {
                  bytes: matched.reduce((sum, row) => sum + row.bytes, 0),
               },
            };
         },
         create: async ({
            data,
         }: {
            data: Omit<ArchiveTicket, "createdAt" | "failures">;
         }) => {
            const row = structuredClone({
               ...data,
               failures: 0,
               createdAt: new Date(),
            });
            rows.set(row.id, row);
            return row;
         },
      },
      $executeRaw: async () => 0,
      $queryRaw: async (
         _strings: TemplateStringsArray,
         ...values: unknown[]
      ) => {
         const [id, userId, serverId, bucket, at] = values as string[];
         const row = rows.get(id!);
         if (
            !row ||
            !matches(row, {
               userId,
               serverId,
               bucket,
               expiresAt: { gt: new Date(at!) },
            })
         )
            return [];
         rows.delete(id!);
         return [{ id: row.id }];
      },
   };
   return {
      ...store,
      $transaction: serialTransactions(store, {
         checkpoint: () => {
            const snapshot = structuredClone(rows);
            return () => {
               rows = snapshot;
            };
         },
      }),
   };
};

export { archiveTicketStore };
