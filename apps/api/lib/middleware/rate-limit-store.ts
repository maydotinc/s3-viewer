import {
   hitRateLimit,
   resetRateLimit,
   undoRateLimitHit,
} from "@s3-viewer/db/rate-limit";
import type { IncrementResponse, Options, Store } from "express-rate-limit";

// express-rate-limit refuses to share one Store instance between limiters, so
// every limiter gets its own instance with its own key prefix. `localKeys` stays
// false: the whole point is that other replicas count the same key.
const postgresStore = (prefix: string): Store => {
   // the library calls init synchronously while the limiter is constructed, so
   // windowMs is always set before the first increment
   let windowMs = 0;
   const scope = (key: string) => `${prefix}${key}`;

   return {
      prefix,
      localKeys: false,
      init: (options: Options) => {
         windowMs = options.windowMs;
      },
      increment: async (key: string): Promise<IncrementResponse> => {
         const { hits, resetAt } = await hitRateLimit(scope(key), windowMs);
         return { totalHits: hits, resetTime: resetAt };
      },
      decrement: (key: string) => undoRateLimitHit(scope(key)),
      resetKey: (key: string) => resetRateLimit(scope(key)),
   };
};

export { postgresStore };
