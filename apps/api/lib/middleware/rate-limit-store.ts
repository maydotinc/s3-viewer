import type { WindowCounter } from "@s3-viewer/shared";
import type { IncrementResponse, Options, Store } from "express-rate-limit";

// request limiters count on the same window counter as the auth throttles and invite budgets.
const windowStore = (
   counter: WindowCounter,
   prefix: string,
   localKeys: boolean
): Store => {
   let windowMs = 0;
   const scope = (key: string) => `${prefix}${key}`;

   return {
      prefix,
      localKeys,
      init: (options: Options) => {
         windowMs = options.windowMs;
      },
      increment: async (key: string): Promise<IncrementResponse> => {
         const { hits, resetAt } = await counter.hit(scope(key), windowMs);
         return { totalHits: hits, resetTime: new Date(resetAt) };
      },
      decrement: (key: string) => counter.undo(scope(key)),
      resetKey: (key: string) => counter.reset(scope(key)),
   };
};

export { windowStore };
