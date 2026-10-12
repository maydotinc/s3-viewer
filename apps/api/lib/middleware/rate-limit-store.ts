import {
   hitRateLimit,
   resetRateLimit,
   undoRateLimitHit,
} from "@s3-viewer/db/rate-limit";
import type { IncrementResponse, Options, Store } from "express-rate-limit";

const postgresStore = (prefix: string): Store => {
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
