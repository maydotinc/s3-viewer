import { cancelledError } from "@/lib/api";

const NEVER_ABORTED = new AbortController().signal;

const RATE_LIMIT_RETRY = { retries: 5, baseMs: 2_000 } as const;

type Backoff = { baseMs: number; maxMs?: number; jitter?: boolean };

const backoffMs = (
   attempt: number,
   { baseMs, maxMs = Infinity, jitter = false }: Backoff
): number =>
   Math.min(maxMs, baseMs * 2 ** attempt) * (jitter ? 0.5 + Math.random() : 1);

const sleep = (ms: number, signal: AbortSignal) =>
   new Promise<void>((resolve) => {
      if (signal.aborted) return resolve();
      const onAbort = () => {
         clearTimeout(timer);
         resolve();
      };
      const timer = setTimeout(() => {
         signal.removeEventListener("abort", onAbort);
         resolve();
      }, ms);
      signal.addEventListener("abort", onAbort, { once: true });
   });

type RetryOptions = Backoff & {
   retries: number;
   shouldRetry: (error: unknown) => boolean;
   signal?: AbortSignal;
};

const retryWithBackoff = async <T>(
   task: () => Promise<T>,
   { retries, shouldRetry, signal = NEVER_ABORTED, ...backoff }: RetryOptions
): Promise<T> => {
   for (let attempt = 0; ; attempt++) {
      try {
         return await task();
      } catch (error) {
         if (attempt >= retries || !shouldRetry(error)) throw error;
         await sleep(backoffMs(attempt, backoff), signal);
         if (signal.aborted) throw cancelledError();
      }
   }
};

export { NEVER_ABORTED, RATE_LIMIT_RETRY, backoffMs, retryWithBackoff, sleep };
