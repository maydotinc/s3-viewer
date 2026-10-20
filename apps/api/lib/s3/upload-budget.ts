import {
   SLOT_MIN_BYTES_PER_SECOND,
   SLOT_MIN_LIFETIME_MS,
} from "@/lib/constants";
import { env } from "@/lib/env";
import { ApiHttpError, rateLimited } from "@/lib/http";
import { SECOND_MS } from "@s3-viewer/types";

type UploadBudgetOptions = {
   maxUploads: number;
   maxPerUser: number;
   maxBytes: number;
   maxPerIp?: number;
};

type Pool = { name: string; share: number };

type UploadBudget = {
   acquire: (
      userId: string,
      bytes: number,
      pool?: Pool,
      ip?: string,
      serverId?: string
   ) => () => void;
};

type SlotPool = {
   active: number;
   bytes: number;
   users: Map<string, number>;
   ips: Map<string, number>;
   servers: Map<string, number>;
};

const UPLOAD_SLOT_MAX_MS = env.UPLOAD_SLOT_MAX_MS;

// unknown sizes get the full cap; the progress floor still ends a stalled body sooner.
const slotLifetimeMs = (
   bytes?: number,
   maxMs: number = UPLOAD_SLOT_MAX_MS
): number =>
   bytes === undefined
      ? maxMs
      : Math.min(
           maxMs,
           Math.max(
              SLOT_MIN_LIFETIME_MS,
              (bytes / SLOT_MIN_BYTES_PER_SECOND) * SECOND_MS
           )
        );

const decrement = (counts: Map<string, number>, key: string): void => {
   const remaining = (counts.get(key) ?? 1) - 1;
   if (remaining) counts.set(key, remaining);
   else counts.delete(key);
};

const UPLOAD_POOL: Pool = { name: "Upload", share: 1 };
const ARCHIVE_POOL: Pool = { name: "Zip", share: 1 / 2 };

const createUploadBudget = ({
   maxUploads,
   maxPerUser,
   maxBytes,
   maxPerIp = env.MAX_IP_UPLOADS,
}: UploadBudgetOptions): UploadBudget => {
   let bytes = 0;
   const pools = new Map<string, SlotPool>();
   const poolFor = (pool: string): SlotPool => {
      const existing = pools.get(pool);
      if (existing) return existing;
      const created: SlotPool = {
         active: 0,
         bytes: 0,
         users: new Map(),
         ips: new Map(),
         servers: new Map(),
      };
      pools.set(pool, created);
      return created;
   };
   return {
      acquire(
         userId: string,
         reservation: number,
         pool: Pool = UPLOAD_POOL,
         ip?: string,
         serverId?: string
      ): () => void {
         if (reservation >= maxBytes)
            throw new ApiHttpError(
               413,
               `This ${pool.name.toLowerCase()} needs more buffer memory than this instance allows`
            );
         const slots = poolFor(pool.name);
         const held = slots.users.get(userId) ?? 0;
         const crowded = slots.active >= Math.ceil(maxUploads / 2);
         // accounts are cheap to mint, so once the pool is crowded an address gets no more slots than one account would;
         // while it is quiet, a team behind one NAT is bound only by the per-account and per-server caps.
         const fromIp = ip ? (slots.ips.get(ip) ?? 0) : 0;
         const ipCap = crowded ? maxPerIp : Infinity;
         // a server's members share its storage, so no server may crowd the others out by spreading across accounts.
         const fromServer = serverId ? (slots.servers.get(serverId) ?? 0) : 0;
         const serverCap = crowded ? Math.ceil(maxUploads / 2) : Infinity;
         // an empty pool always admits one reservation, so a small share can't lock it out.
         const overShare =
            slots.bytes > 0 &&
            slots.bytes + reservation > maxBytes * pool.share;
         if (
            slots.active >= maxUploads ||
            held >= (crowded ? 1 : maxPerUser) ||
            fromIp >= ipCap ||
            fromServer >= serverCap ||
            overShare ||
            bytes + reservation > maxBytes
         ) {
            throw rateLimited(
               `${pool.name} capacity is busy. Try again shortly.`
            );
         }
         slots.active++;
         slots.bytes += reservation;
         bytes += reservation;
         slots.users.set(userId, held + 1);
         if (ip) slots.ips.set(ip, fromIp + 1);
         if (serverId) slots.servers.set(serverId, fromServer + 1);
         let released = false;
         return () => {
            if (released) return;
            released = true;
            slots.active--;
            slots.bytes -= reservation;
            bytes -= reservation;
            decrement(slots.users, userId);
            if (ip) decrement(slots.ips, ip);
            if (serverId) decrement(slots.servers, serverId);
         };
      },
   };
};

const uploadBudget = createUploadBudget({
   maxUploads: env.MAX_CONCURRENT_UPLOADS,
   maxPerUser: env.MAX_USER_UPLOADS,
   maxBytes: env.UPLOAD_MEMORY_BUDGET_BYTES,
});

export {
   ARCHIVE_POOL,
   UPLOAD_SLOT_MAX_MS,
   createUploadBudget,
   slotLifetimeMs,
   uploadBudget,
};
export type { Pool };
