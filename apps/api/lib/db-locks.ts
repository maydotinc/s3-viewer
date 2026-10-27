import { Prisma } from "@prisma/client";

// must stay stable across replicas; two-int4 locks never collide with single-int8 ones.
const LOCK_NAMESPACE = {
   AUDIT_APPEND: 1,
   INVITE_SEND: 2,
   SERVER_CREATE: 3,
   MAINTENANCE_SWEEP: 4,
   ARCHIVE_TICKET: 5,
   BUCKET_CREATION: 6,
} as const;

type LockNamespace = (typeof LOCK_NAMESPACE)[keyof typeof LOCK_NAMESPACE];

// ::int4 selects the two-key advisory-lock overload the namespaces use.
const lockKey = (key: number | string): Prisma.Sql =>
   typeof key === "number"
      ? Prisma.sql`${key}::int4`
      : Prisma.sql`hashtext(${key})`;

const xactLock = async (
   tx: Prisma.TransactionClient,
   namespace: LockNamespace,
   key: number | string
): Promise<void> => {
   await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(
         ${namespace}::int4, ${lockKey(key)}
      )
   `;
};

const tryXactLock = async (
   tx: Prisma.TransactionClient,
   namespace: LockNamespace,
   key: number | string
): Promise<boolean> => {
   const [lock] = await tx.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_xact_lock(
         ${namespace}::int4, ${lockKey(key)}
      ) AS locked
   `;
   return lock?.locked === true;
};

export { LOCK_NAMESPACE, tryXactLock, xactLock };
