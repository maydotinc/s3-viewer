import type { S3Client } from "@aws-sdk/client-s3";
import { MINUTE_MS } from "@s3-viewer/types";
import { env } from "@/lib/env";
import { rateLimited } from "./errors";
import { readUserId } from "./read-budget";
import { withBufferedResponses } from "./response-collector";

type Window = {
   count: number;
   resetAt: number;
   sharedUntil: number;
   users: Map<string, number>;
};

const SWEEP_ABOVE = 1000;
const USER_SHARE = 7 / 8;
const SHARE_HOLD_MS = 2 * MINUTE_MS;

const windows = new Map<string, Window>();
const inFlightByServer = new Map<string, number>();
const inFlightByUser = new Map<string, number>();
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

const userShare = (): number =>
   Math.max(1, Math.floor(env.S3_REQUESTS_PER_MINUTE * USER_SHARE));

const sweep = (now: number): void => {
   for (const [serverId, window] of windows) {
      if (window.resetAt <= now && window.sharedUntil <= now)
         windows.delete(serverId);
   }
};

const spendRequest = (serverId: string, userId = readUserId()): void => {
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
      const spent = (open.users.get(userId) ?? 0) + 1;
      open.users.set(userId, spent);
      if (open.users.size > 1) open.sharedUntil = now + SHARE_HOLD_MS;
      if (open.sharedUntil > now && spent > userShare())
         throw userBudgetExhausted();
   }
   open.count += 1;
   if (open.count > env.S3_REQUESTS_PER_MINUTE) throw budgetExhausted();
};

const bump = (counts: Map<string, number>, key: string, by: 1 | -1): void => {
   const next = (counts.get(key) ?? 0) + by;
   if (next > 0) counts.set(key, next);
   else counts.delete(key);
};

// counts calls still waiting on storage's response head, the phase a tarpit endpoint can stretch.
// one account holds at most 64 of the default 1000 pooled sockets and one server 32, so even 20
// servers stay under the user cap; open bodies are bounded by the read budget and progress floors.
const acquireInFlight = (
   serverId: string,
   userId = readUserId()
): (() => void) => {
   if ((inFlightByServer.get(serverId) ?? 0) >= env.S3_MAX_INFLIGHT_PER_SERVER)
      throw serverBusy();
   if (
      userId !== undefined &&
      (inFlightByUser.get(userId) ?? 0) >= env.S3_MAX_INFLIGHT_PER_USER
   )
      throw userBusy();
   bump(inFlightByServer, serverId, 1);
   if (userId !== undefined) bump(inFlightByUser, userId, 1);
   let released = false;
   return () => {
      if (released) return;
      released = true;
      bump(inFlightByServer, serverId, -1);
      if (userId !== undefined) bump(inFlightByUser, userId, -1);
   };
};

// initialize runs before the retry middleware, so a refusal is never sent or replayed.
const withRequestBudget = (client: S3Client, serverId: string): S3Client => {
   withBufferedResponses(client, serverId);
   serverOfClient.set(client, serverId);
   client.middlewareStack.add(
      (next) => async (args) => {
         const release = acquireInFlight(serverId);
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

const budgetServerOf = (client: S3Client): string | undefined =>
   serverOfClient.get(client);

const resetRequestBudgets = (): void => {
   windows.clear();
   inFlightByServer.clear();
   inFlightByUser.clear();
};

export { budgetServerOf, resetRequestBudgets, spendRequest, withRequestBudget };
