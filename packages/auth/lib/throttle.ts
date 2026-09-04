type Throttle = {
   allow: (key: string, now?: number) => boolean;
   size: () => number;
};

const SWEEP_EVERY = 1000;

// sliding window per key, in memory and per process, like the express
// limiters in apps/api: a soft ceiling, not a guarantee across instances
const createThrottle = (limit: number, windowMs: number): Throttle => {
   const hits = new Map<string, number[]>();
   let calls = 0;

   const prune = (stamps: number[], now: number): number[] =>
      stamps.filter((stamp) => now - stamp < windowMs);

   const sweep = (now: number) => {
      for (const [key, stamps] of hits) {
         const live = prune(stamps, now);
         if (live.length === 0) hits.delete(key);
         else hits.set(key, live);
      }
   };

   return {
      allow: (key, now = Date.now()) => {
         if (++calls % SWEEP_EVERY === 0) sweep(now);
         const live = prune(hits.get(key) ?? [], now);
         if (live.length >= limit) {
            hits.set(key, live);
            return false;
         }
         live.push(now);
         hits.set(key, live);
         return true;
      },
      size: () => hits.size,
   };
};

export { createThrottle };
export type { Throttle };
