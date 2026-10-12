import { MINUTE_MS } from "@s3-viewer/types";
import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let now: number | null = null;
let timer: ReturnType<typeof setInterval> | undefined;

const tick = () => {
   now = Date.now();
   for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
   listeners.add(listener);
   if (listeners.size === 1) {
      now = Date.now();
      timer = setInterval(tick, MINUTE_MS);
   }
   return () => {
      listeners.delete(listener);
      if (listeners.size > 0) return;
      clearInterval(timer);
      now = null;
   };
};

const useNow = (): number | null =>
   useSyncExternalStore(
      subscribe,
      () => (now ??= Date.now()),
      () => null
   );

export { useNow };
