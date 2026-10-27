import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

const listeners = new Set<() => void>();
let media: MediaQueryList | undefined;

const mediaQuery = () => (media ??= window.matchMedia(QUERY));

const notify = () => listeners.forEach((listener) => listener());

// one media query listener shared by every animated element on the page.
const subscribe = (listener: () => void) => {
   if (listeners.size === 0) mediaQuery().addEventListener("change", notify);
   listeners.add(listener);
   return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
         mediaQuery().removeEventListener("change", notify);
      }
   };
};

export const useReducedMotion = () =>
   useSyncExternalStore(
      subscribe,
      () => mediaQuery().matches,
      () => false
   );
