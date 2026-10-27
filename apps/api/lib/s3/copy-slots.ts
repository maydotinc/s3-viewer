import type { S3Client } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";
import {
   keyedSlots,
   type Release,
   type SlotClaim,
} from "@/lib/utils/keyed-slots";
import { StorageError } from "./errors";
import { readUserId } from "./read-budget";
import { budgetServerOf } from "./request-budget";

// CopyObject and UploadPartCopy hold their in-flight slot for the whole server-side copy, so copies wait
// for half the server's cap instead of refusing teammates (and their own parts) once a bulk move fills it.
const slots = keyedSlots();

type Claims = readonly (SlotClaim | undefined)[];
type Waiter = { claims: Claims; admit: (release: Release) => void };

const queues = new Map<string, Set<Waiter>>();

const serverCap = (): number =>
   Math.max(1, Math.floor(env.S3_MAX_INFLIGHT_PER_SERVER / 2));

// one user's bulk move leaves room for a teammate's rename to start.
const userCap = (): number => Math.ceil(serverCap() / 2);

// tryAcquire never refuses, so this only satisfies the claim shape.
const neverRefused = (): Error => new Error("copy slots wait instead");

const copiesBusy = (): StorageError =>
   new StorageError("busy", "Storage is busy with other copies. Try again.");

const claimsFor = (serverId: string, userId: string | undefined): Claims => [
   [`server:${serverId}`, serverCap(), neverRefused],
   userId === undefined
      ? undefined
      : [`user:${serverId}:${userId}`, userCap(), neverRefused],
];

// a release serves the oldest waiter whose user still has room, so a capped user never blocks the queue.
const serve = (serverId: string): void => {
   const queue = queues.get(serverId);
   if (!queue) return;
   for (const waiter of queue) {
      const release = take(serverId, waiter.claims);
      if (!release) continue;
      queue.delete(waiter);
      waiter.admit(release);
   }
   if (queue.size === 0) queues.delete(serverId);
};

const take = (serverId: string, claims: Claims): Release | undefined =>
   slots.tryAcquire(claims, () => serve(serverId));

const isTimeout = (reason: unknown): boolean =>
   reason instanceof Error && reason.name === "TimeoutError";

// after every release only waiters that cannot take a slot remain queued, so a newcomer that can is not overtaking.
const admit = (
   serverId: string,
   claims: Claims,
   signal: AbortSignal | undefined
): Promise<Release> => {
   signal?.throwIfAborted();
   const taken = take(serverId, claims);
   if (taken) return Promise.resolve(taken);
   return new Promise((resolve, reject) => {
      const queue = queues.get(serverId) ?? new Set<Waiter>();
      queues.set(serverId, queue);
      const onAbort = () => {
         queue.delete(waiter);
         if (queue.size === 0) queues.delete(serverId);
         // the copy never reached storage, so a deadline spent queueing means busy, not unreachable.
         reject(isTimeout(signal?.reason) ? copiesBusy() : signal?.reason);
      };
      const waiter: Waiter = {
         claims,
         admit: (release) => {
            signal?.removeEventListener("abort", onAbort);
            resolve(release);
         },
      };
      queue.add(waiter);
      signal?.addEventListener("abort", onAbort, { once: true });
   });
};

const withCopySlot = async <T>(
   client: S3Client,
   signal: AbortSignal | undefined,
   copy: () => Promise<T>
): Promise<T> => {
   const serverId = budgetServerOf(client) ?? "unscoped";
   const release = await admit(
      serverId,
      claimsFor(serverId, readUserId()),
      signal
   );
   try {
      return await copy();
   } finally {
      release();
   }
};

export { withCopySlot };
