import { hitRateLimit, undoRateLimitHit } from "@s3-viewer/db/rate-limit";
import { describeError } from "@s3-viewer/types";

type Throttle = {
   allow: (key: string, now?: number) => Promise<boolean>;
   refund: (key: string) => Promise<void>;
   size: () => number;
};

type ThrottleOptions = { name: string; shared: boolean };

const SWEEP_EVERY = 1000;
const MAX_KEYS = 20_000;

type Window = { hits: number; resetAt: number };

// a fixed window from the first hit that counts refused attempts too, like the
// rate_limit table behind the shared store, so RATE_LIMIT_STORE=memory behaves the same.
const memoryThrottle = (limit: number, windowMs: number): Throttle => {
   const windows = new Map<string, Window>();
   let calls = 0;

   const sweep = (now: number) => {
      for (const [key, { resetAt }] of windows) {
         if (resetAt <= now) windows.delete(key);
      }
   };

   return {
      allow: async (key, now = Date.now()) => {
         if (++calls % SWEEP_EVERY === 0) sweep(now);
         const current = windows.get(key);
         const window =
            current && current.resetAt > now
               ? { hits: current.hits + 1, resetAt: current.resetAt }
               : { hits: 1, resetAt: now + windowMs };
         windows.delete(key);
         windows.set(key, window);
         for (const oldest of windows.keys()) {
            if (windows.size <= MAX_KEYS) break;
            windows.delete(oldest);
         }
         return window.hits <= limit;
      },
      refund: async (key) => {
         const window = windows.get(key);
         if (window) window.hits = Math.max(window.hits - 1, 0);
      },
      size: () => windows.size,
   };
};

const sharedThrottle = (
   limit: number,
   windowMs: number,
   name: string
): Throttle => ({
   allow: async (key) => {
      try {
         const { hits } = await hitRateLimit(
            `throttle:${name}:${key}`,
            windowMs
         );
         return hits <= limit;
      } catch (error) {
         console.error(
            `[auth] ${name} throttle unavailable: ${describeError(error)}`
         );
         return false;
      }
   },
   refund: async (key) => {
      try {
         await undoRateLimitHit(`throttle:${name}:${key}`);
      } catch (error) {
         console.error(
            `[auth] ${name} throttle refund failed: ${describeError(error)}`
         );
      }
   },
   size: () => 0,
});

const createThrottle = (
   limit: number,
   windowMs: number,
   options?: ThrottleOptions
): Throttle =>
   options?.shared
      ? sharedThrottle(limit, windowMs, options.name)
      : memoryThrottle(limit, windowMs);

type ThrottleKey = (ip: string, email: string) => string | null;

const perAddress = (_ip: string, email: string): string => email;
const perAddressAndIp = (ip: string, email: string): string => `${ip}:${email}`;
const perIp = (ip: string): string | null => ip || null;

export { createThrottle, perAddress, perAddressAndIp, perIp };
export type { Throttle, ThrottleKey };
