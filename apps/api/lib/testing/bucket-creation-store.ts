import type { BucketCreation } from "@prisma/client";
import { serialTransactions } from "./serial-transaction";

const bucketCreationStore = () => {
   const rows = new Map<string, BucketCreation>();
   const store = {
      rows,
      bucketCreation: {
         findUnique: async ({
            where,
         }: {
            where: {
               namespace_bucketName: { namespace: string; bucketName: string };
            };
         }) =>
            rows.get(
               `${where.namespace_bucketName.namespace}/${where.namespace_bucketName.bucketName}`
            ) ?? null,
         count: async ({
            where,
         }: {
            where: { userId: string } | { namespace: string };
         }) =>
            [...rows.values()].filter((row) =>
               "userId" in where
                  ? row.userId === where.userId
                  : row.namespace === where.namespace
            ).length,
         create: async ({
            data,
         }: {
            data: Omit<BucketCreation, "createdAt" | "submitted">;
         }) => {
            const row = { ...data, createdAt: new Date(), submitted: false };
            if (rows.has(`${row.namespace}/${row.bucketName}`))
               throw new Error("Duplicate bucket claim");
            rows.set(`${row.namespace}/${row.bucketName}`, row);
            return row;
         },
         update: async ({
            where,
            data,
         }: {
            where: { operation: string };
            data: { submitted: boolean };
         }) => {
            const row = [...rows.values()].find(
               (row) => row.operation === where.operation
            );
            if (!row) throw new Error("Missing bucket claim");
            Object.assign(row, data);
            return row;
         },
         deleteMany: async ({
            where,
         }: {
            where: { operation: string } | { createdAt: { lt: Date } };
         }) => {
            let count = 0;
            for (const [name, row] of rows)
               if (
                  "operation" in where
                     ? row.operation === where.operation
                     : row.createdAt < where.createdAt.lt
               ) {
                  rows.delete(name);
                  count++;
               }
            return { count };
         },
      },
      $executeRaw: async () => 0,
   };
   return { ...store, $transaction: serialTransactions(store) };
};

export { bucketCreationStore };
