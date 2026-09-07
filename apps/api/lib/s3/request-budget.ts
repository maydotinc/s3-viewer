import type { S3Client } from "@aws-sdk/client-s3";
import { ErrorCode, MINUTE_MS } from "@s3-viewer/types";
import { env } from "../env";
import { ApiHttpError } from "../http";

// one fixed window per server, per process: a single member cannot turn a cheap
// route into an unbounded upstream bill for everyone sharing the storage account
type Window = { count: number; resetAt: number };

const SWEEP_ABOVE = 1000;

const windows = new Map<string, Window>();
// regional clients are built from a base client's config, which carries no
// server id, so the base client is what remembers which budget it spends
const serverOfClient = new WeakMap<S3Client, string>();

const budgetExhausted = (): ApiHttpError =>
   new ApiHttpError(
      429,
      "This server has made too many storage requests. Try again in a minute.",
      ErrorCode.RATE_LIMITED
   );

const sweep = (now: number): void => {
   for (const [serverId, window] of windows) {
      if (window.resetAt <= now) windows.delete(serverId);
   }
};

const spendRequest = (serverId: string): void => {
   const now = Date.now();
   const open = windows.get(serverId);
   if (open && open.resetAt > now) {
      open.count += 1;
      if (open.count > env.S3_REQUESTS_PER_MINUTE) throw budgetExhausted();
      return;
   }
   if (windows.size >= SWEEP_ABOVE) sweep(now);
   // S3_REQUESTS_PER_MINUTE is a positive integer, so the first call of a
   // window is always within budget
   windows.set(serverId, { count: 1, resetAt: now + MINUTE_MS });
};

// initialize runs before serialization and before the retry middleware, so a
// refusal costs nothing upstream and is never replayed
const withRequestBudget = (client: S3Client, serverId: string): S3Client => {
   serverOfClient.set(client, serverId);
   client.middlewareStack.add(
      (next) => (args) => {
         spendRequest(serverId);
         return next(args);
      },
      { step: "initialize", name: "requestBudget" }
   );
   return client;
};

const budgetServerOf = (client: S3Client): string | undefined =>
   serverOfClient.get(client);

const resetRequestBudgets = (): void => windows.clear();

export { budgetServerOf, resetRequestBudgets, spendRequest, withRequestBudget };
