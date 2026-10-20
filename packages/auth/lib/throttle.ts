import {
   memoryWindowCounter,
   sharedWindowCounter,
} from "@s3-viewer/db/rate-limit";
import { describeError } from "@s3-viewer/types";

type Throttle = {
   allow: (key: string, now?: number) => Promise<boolean>;
   refund: (key: string) => Promise<void>;
};

type ThrottleOptions = { name: string; shared: boolean };

const MAX_KEYS = 20_000;

const memoryThrottle = (limit: number, windowMs: number): Throttle => {
   const counter = memoryWindowCounter(MAX_KEYS);
   return {
      allow: async (key, now) =>
         (await counter.hit(key, windowMs, now)) <= limit,
      refund: counter.undo,
   };
};

const sharedThrottle = (
   limit: number,
   windowMs: number,
   name: string
): Throttle => ({
   allow: async (key) => {
      try {
         const hits = await sharedWindowCounter.hit(
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
         await sharedWindowCounter.undo(`throttle:${name}:${key}`);
      } catch (error) {
         console.error(
            `[auth] ${name} throttle refund failed: ${describeError(error)}`
         );
      }
   },
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
