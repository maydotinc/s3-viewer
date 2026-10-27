import {
   SLOT_MIN_BYTES_PER_SECOND,
   SLOT_MIN_LIFETIME_MS,
} from "@/lib/constants";
import { env } from "@/lib/env";
import { keyedSlots, type KeyedSlots } from "@/lib/utils/keyed-slots";
import { SECOND_MS } from "@s3-viewer/shared";
import { refusal, StorageError } from "./errors";

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

type SlotPool = { inFlight: KeyedSlots; bytes: number };

const UPLOAD_SLOT_MAX_MS = env.UPLOAD_SLOT_MAX_MS;

// unknown sizes get the full cap; the progress floor still ends a stalled body sooner.
const slotLifetimeMs = (bytes?: number): number =>
   bytes === undefined
      ? UPLOAD_SLOT_MAX_MS
      : Math.min(
           UPLOAD_SLOT_MAX_MS,
           Math.max(
              SLOT_MIN_LIFETIME_MS,
              (bytes / SLOT_MIN_BYTES_PER_SECOND) * SECOND_MS
           )
        );

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
      const created: SlotPool = { inFlight: keyedSlots(), bytes: 0 };
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
            throw new StorageError(
               "tooLarge",
               `This ${pool.name.toLowerCase()} needs more buffer memory than this instance allows`
            );
         const slots = poolFor(pool.name);
         const busy = () =>
            refusal(`${pool.name} capacity is busy. Try again shortly.`);
         const crowded =
            slots.inFlight.held("all") >= Math.ceil(maxUploads / 2);
         // an empty pool always admits one reservation, so a small share can't lock it out.
         const overShare =
            slots.bytes > 0 &&
            slots.bytes + reservation > maxBytes * pool.share;
         if (overShare || bytes + reservation > maxBytes) throw busy();
         const release = slots.inFlight.acquire(
            [
               ["all", maxUploads, busy],
               [`user:${userId}`, crowded ? 1 : maxPerUser, busy],
               // accounts are cheap to mint, so once the pool is crowded an address gets no more slots than one account would;
               // while it is quiet, a team behind one NAT is bound only by the per-account and per-server caps.
               ip
                  ? [`ip:${ip}`, crowded ? maxPerIp : Infinity, busy]
                  : undefined,
               // a server's members share its storage, so no server may crowd the others out by spreading across accounts.
               serverId
                  ? [
                       `server:${serverId}`,
                       crowded ? Math.ceil(maxUploads / 2) : Infinity,
                       busy,
                    ]
                  : undefined,
            ],
            () => {
               slots.bytes -= reservation;
               bytes -= reservation;
            }
         );
         slots.bytes += reservation;
         bytes += reservation;
         return release;
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
