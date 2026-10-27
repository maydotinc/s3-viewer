const noop = (): void => undefined;

const abortReason = (signal: AbortSignal, fallback: string): Error =>
   signal.reason instanceof Error ? signal.reason : new Error(fallback);

const waitForSharedOperation = <T>(
   pending: Promise<T>,
   signal: AbortSignal | undefined
): Promise<T> => {
   if (!signal) return pending;
   return new Promise<T>((resolve, reject) => {
      const onAbort = () => reject(signal.reason);
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
      pending.then(resolve, reject).finally(() => {
         signal.removeEventListener("abort", onAbort);
      });
   });
};

// the timer is cleared once `run` settles, so a finished call holds no timer for the full timeout.
const withDeadline = async <T>(
   signal: AbortSignal | undefined,
   timeoutMs: number,
   run: (signal: AbortSignal) => Promise<T>
): Promise<T> => {
   const deadline = new AbortController();
   const timer = setTimeout(
      () =>
         deadline.abort(
            new DOMException("The operation timed out.", "TimeoutError")
         ),
      timeoutMs
   );
   try {
      return await run(
         signal ? AbortSignal.any([signal, deadline.signal]) : deadline.signal
      );
   } finally {
      clearTimeout(timer);
   }
};

export { abortReason, noop, waitForSharedOperation, withDeadline };
