import { useEffect, useState, useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

const subscribe = (onChange: () => void) => {
   const media = window.matchMedia(QUERY);
   media.addEventListener("change", onChange);
   return () => media.removeEventListener("change", onChange);
};

export const useReducedMotion = () =>
   useSyncExternalStore(
      subscribe,
      () => window.matchMedia(QUERY).matches,
      () => false
   );

type Options = { steps: number; interval: number; active: boolean };

// cycles 0..steps-1 while `active`; a click can jump with the setter and the
// timer restarts from that state so it does not immediately advance again.
export const useAutoplay = ({ steps, interval, active }: Options) => {
   const [step, setStep] = useState(0);
   const [restartKey, setRestartKey] = useState(0);
   const reduced = useReducedMotion();

   useEffect(() => {
      if (!active || reduced) return;
      const id = window.setInterval(
         () => setStep((s) => (s + 1) % steps),
         interval
      );
      return () => window.clearInterval(id);
   }, [active, reduced, steps, interval, restartKey]);

   const jump = (next: number) => {
      setStep(next % steps);
      setRestartKey((k) => k + 1);
   };

   return [step, jump] as const;
};
