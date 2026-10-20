import type { S3Client } from "@aws-sdk/client-s3";
import { MINUTE_MS } from "@s3-viewer/types";
import { env } from "@/lib/env";
import { bump, countOf } from "@/lib/utils/counter-map";
import { rateLimited } from "./errors";
import { readUserId } from "./read-budget";
import {
   admitCommittingWrite,
   withBufferedResponses,
} from "./response-collector";

type Window = {
   count: number;
   resetAt: number;
   sharedUntil: number;
   users: Map<string, number>;
};

type InFlightPool = {
   byServer: Map<string, number>;
   byUser: Map<string, number>;
   serverCap: () => number;
   userCap: () => number;
   serverBusy: () => Error;
   userBusy: () => Error;
};

const SWEEP_ABOVE = 1000;
const USER_SHARE = 7 / 8;
const SHARE_HOLD_MS = 2 * MINUTE_MS;
const CANCELS_PER_SERVER = 16;
const CANCELS_PER_USER = 8;

const windows = new Map<string, Window>();
const serverOfClient = new WeakMap<S3Client, string>();

const budgetExhausted = () =>
   rateLimited(
      "This server has made too many storage requests. Try again in a minute."
   );

const userBudgetExhausted = () =>
   rateLimited(
      "You have made too many storage requests on this server. Try again in a minute."
   );

const serverBusy = () =>
   rateLimited(
      "This server has too many storage requests in progress. Try again shortly."
   );

const userBusy = () =>
   rateLimited(
      "You have too many storage requests in progress. Try again shortly."
   );

const requests: InFlightPool = {
   byServer: new Map(),
   byUser: new Map(),
   serverCap: () => env.S3_MAX_INFLIGHT_PER_SERVER,
   userCap: () => env.S3_MAX_INFLIGHT_PER_USER,
   serverBusy,
   userBusy,
};

const cancels: InFlightPool = {
   byServer: new Map(),
   byUser: new Map(),
   serverCap: () => CANCELS_PER_SERVER,
   userCap: () => CANCELS_PER_USER,
   serverBusy: () =>
      rateLimited(
         "This server has too many cancellations in progress. Try again shortly."
      ),
   userBusy: () =>
      rateLimited(
         "You have too many cancellations in progress. Try again shortly."
      ),
};

const userShare = (): number =>
   Math.max(1, Math.floor(env.S3_REQUESTS_PER_MINUTE * USER_SHARE));

const sweep = (now: number): void => {
   for (const [serverId, window] of windows) {
      if (window.resetAt <= now && window.sharedUntil <= now)
         windows.delete(serverId);
   }
};

const spendRequest = (serverId: string): void => {
   const userId = readUserId();
   const now = Date.now();
   let open = windows.get(serverId);
   if (!open || open.resetAt <= now) {
      const sharedUntil = open?.sharedUntil ?? 0;
      if (windows.size >= SWEEP_ABOVE) sweep(now);
      open = {
         count: 0,
         resetAt: now + MINUTE_MS,
         sharedUntil,
         users: new Map(),
      };
      windows.set(serverId, open);
   }
   if (userId !== undefined) {
      const spent = bump(open.users, userId, 1);
      if (open.users.size > 1) open.sharedUntil = now + SHARE_HOLD_MS;
      if (open.sharedUntil > now && spent > userShare())
         throw userBudgetExhausted();
   }
   open.count += 1;
   if (open.count > env.S3_REQUESTS_PER_MINUTE) throw budgetExhausted();
};

// counts calls still waiting on storage's response head, the phase a tarpit endpoint can stretch.
// one account holds at most 64 request sockets plus 8 cancel sockets of the default 1000 pooled,
// and one server 32 plus 16, so even 20 servers stay under the user caps; open bodies are bounded
// by the read budget and progress floors.
const acquireInFlight = (
   pool: InFlightPool,
   serverId: string
): (() => void) => {
   const userId = readUserId();
   if (countOf(pool.byServer, serverId) >= pool.serverCap())
      throw pool.serverBusy();
   if (userId !== undefined && countOf(pool.byUser, userId) >= pool.userCap())
      throw pool.userBusy();
   bump(pool.byServer, serverId, 1);
   if (userId !== undefined) bump(pool.byUser, userId, 1);
   let released = false;
   return () => {
      if (released) return;
      released = true;
      bump(pool.byServer, serverId, -1);
      if (userId !== undefined) bump(pool.byUser, userId, -1);
   };
};

// initialize runs before the retry middleware, so a refusal is never sent or replayed.
const withRequestBudget = (client: S3Client, serverId: string): S3Client => {
   withBufferedResponses(client, serverId);
   serverOfClient.set(client, serverId);
   client.middlewareStack.add(
      (next, context) => async (args) => {
         admitCommittingWrite(serverId, context.commandName);
         const release = acquireInFlight(requests, serverId);
         try {
            spendRequest(serverId);
            return await next(args);
         } finally {
            release();
         }
      },
      { step: "initialize", name: "requestBudget" }
   );
   return client;
};

// a user's cancel skips the minute window so a spent budget can't strand billable parts, but it
// still holds a pooled socket for up to the cleanup deadline, so it draws on a small pool of its own.
// 8 per user covers two tabs cancelling every active upload (FILE_CONCURRENCY is 3 per tab).
const withCancelBudget = (client: S3Client, serverId: string): S3Client => {
   withBufferedResponses(client, serverId);
   client.middlewareStack.add(
      (next) => async (args) => {
         const release = acquireInFlight(cancels, serverId);
         try {
            return await next(args);
         } finally {
            release();
         }
      },
      { step: "initialize", name: "cancelBudget" }
   );
   return client;
};

const budgetServerOf = (client: S3Client): string | undefined =>
   serverOfClient.get(client);

const resetRequestBudgets = (): void => {
   windows.clear();
   for (const pool of [requests, cancels]) {
      pool.byServer.clear();
      pool.byUser.clear();
   }
};

export {
   budgetServerOf,
   resetRequestBudgets,
   spendRequest,
   withCancelBudget,
   withRequestBudget,
};
