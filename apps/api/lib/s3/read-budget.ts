import { MIB, SECOND_MS } from "@s3-viewer/types";
import { AsyncLocalStorage } from "node:async_hooks";
import type { ServerResponse } from "node:http";
import { bump, countOf } from "@/lib/utils/counter-map";
import { keyedSlots } from "@/lib/utils/keyed-slots";
import { rateLimited } from "./errors";

// storage has already acted on a committed request, so refusing its response would only hide that it landed.
type ReadScope = { serverId: string; userId?: string; committed?: boolean };
type ReadReservation = {
   retain: (bytes: number) => void;
   discard: (bytes: number) => void;
   finishRead: () => void;
   release: () => void;
};
type Contention = {
   // pool utilisation, 0-1, at which tenants are held to the smaller share.
   above: number;
   // largest fraction of the whole pool one user or server may hold while contended.
   share: number;
   // how long a refusal for lack of pool keeps the pool contended.
   holdMs: number;
};
type ReadBudgetOptions = {
   maxBytes: number;
   maxUserBytes: number;
   maxServerBytes: number;
   maxReads: number;
   maxUserReads: number;
   maxServerReads: number;
   contention?: Contention;
};

// raw chunks, concatenation and deserialization can coexist in memory.
const BUFFER_MEMORY_FACTOR = 4;
// SDK CDATA values can be slices that keep the entire XML document alive.
const copyRetainedString = (value: string): string =>
   Buffer.from(value, "utf16le").toString("utf16le");
type ResponseReads = { closed: boolean; reservations: Set<ReadReservation> };
const userContext = new AsyncLocalStorage<{
   userId: string;
   response?: ResponseReads;
}>();

const withReadUser = <T>(userId: string, run: () => T): T =>
   userContext.run({ userId }, run);

const readUserId = (): string | undefined => userContext.getStore()?.userId;

const withReadResponse = <T>(
   userId: string,
   res: ServerResponse,
   run: () => T
): T => {
   const response: ResponseReads = {
      closed: res.destroyed || res.writableFinished,
      reservations: new Set(),
   };
   const release = () => {
      response.closed = true;
      res.off("finish", release);
      res.off("close", release);
      for (const reservation of response.reservations) reservation.release();
      response.reservations.clear();
   };
   if (!response.closed) {
      res.once("finish", release);
      res.once("close", release);
   }
   return userContext.run({ userId, response }, run);
};

const retainForResponse = (reservation: ReadReservation): (() => void) => {
   reservation.finishRead();
   const response = userContext.getStore()?.response;
   if (response && !response.closed) response.reservations.add(reservation);
   else reservation.release();
   return () => {
      response?.reservations.delete(reservation);
      reservation.release();
   };
};

const readCapacityError = () =>
   rateLimited("Storage response capacity is busy. Try again shortly.");

const createReadBudget = (limits: ReadBudgetOptions) => {
   const reads = keyedSlots();
   let totalBytes = 0;
   const userBytes = new Map<string, number>();
   const serverBytes = new Map<string, number>();
   let contendedUntil = 0;

   // two accounts at half the pool each would starve everyone else, so shares shrink once the pool is half used
   // or someone has just been turned away for lack of it.
   const share = (limit: number, pool: number): number => {
      const { contention } = limits;
      if (!contention) return limit;
      const contended =
         reads.held("all") >= limits.maxReads * contention.above ||
         totalBytes >= limits.maxBytes * contention.above ||
         Date.now() < contendedUntil;
      return contended
         ? Math.min(limit, Math.max(1, Math.floor(pool * contention.share)))
         : limit;
   };
   const poolFull = () => {
      if (limits.contention)
         contendedUntil = Date.now() + limits.contention.holdMs;
      return readCapacityError();
   };

   const acquire = ({
      serverId,
      userId = readUserId(),
      committed = false,
   }: ReadScope): ReadReservation => {
      const userKey = userId ?? "internal";
      const cap = (limit: number): number => (committed ? Infinity : limit);
      const finishReading = reads.acquire([
         ["all", cap(limits.maxReads), poolFull],
         [
            `user:${userKey}`,
            cap(share(limits.maxUserReads, limits.maxReads)),
            readCapacityError,
         ],
         [
            `server:${serverId}`,
            cap(share(limits.maxServerReads, limits.maxReads)),
            readCapacityError,
         ],
      ]);
      let held = 0;
      let reading = true;
      const hold = (bytes: number) => {
         held += bytes;
         totalBytes += bytes;
         bump(userBytes, userKey, bytes);
         bump(serverBytes, serverId, bytes);
      };
      const finishRead = () => {
         reading = false;
         finishReading();
      };
      const discard = (bytes: number) => {
         if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > held)
            throw new Error("Invalid read reservation discard size");
         hold(-bytes);
      };

      return {
         retain(bytes) {
            if (!reading)
               throw new Error("Read reservation is no longer reading");
            if (!Number.isSafeInteger(bytes) || bytes < 0)
               throw new Error("Invalid read reservation size");
            if (!committed) {
               if (totalBytes + bytes > limits.maxBytes) throw poolFull();
               if (
                  countOf(userBytes, userKey) + bytes >
                     share(limits.maxUserBytes, limits.maxBytes) ||
                  countOf(serverBytes, serverId) + bytes >
                     share(limits.maxServerBytes, limits.maxBytes)
               )
                  throw readCapacityError();
            }
            hold(bytes);
         },
         discard,
         finishRead,
         release() {
            finishRead();
            discard(held);
         },
      };
   };
   return { acquire };
};

const readBudget = createReadBudget({
   maxBytes: 256 * MIB,
   maxUserBytes: 128 * MIB,
   maxServerBytes: 128 * MIB,
   maxReads: 128,
   maxUserReads: 64,
   maxServerReads: 64,
   contention: { above: 1 / 2, share: 1 / 4, holdMs: 10 * SECOND_MS },
});

const retainedRead = async <T>(
   serverId: string | undefined,
   read: (reservation: ReadReservation) => Promise<T>
): Promise<T> => {
   const reservation = readBudget.acquire({ serverId: serverId ?? "unscoped" });
   try {
      const result = await read(reservation);
      retainForResponse(reservation);
      return result;
   } catch (error) {
      reservation.release();
      throw error;
   }
};

export {
   BUFFER_MEMORY_FACTOR,
   createReadBudget,
   copyRetainedString,
   readBudget,
   readUserId,
   retainedRead,
   retainForResponse,
   withReadResponse,
   withReadUser,
};
export type { ReadReservation };
