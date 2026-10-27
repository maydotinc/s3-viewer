import { useInView } from "@/lib/hooks/use-in-view";
import { usePageVisible } from "@/lib/hooks/use-page-visible";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { useEffect, useState } from "react";
import { useHoverPause } from "./use-hover-pause";

type Options = { steps: number; interval: number };

export const useAutoplay = ({ steps, interval }: Options) => {
   const [ref, inView] = useInView<HTMLDivElement>();
   const { hovered, hoverProps } = useHoverPause();
   const visible = usePageVisible();
   const reduced = useReducedMotion();
   const [step, setStep] = useState(0);
   const [restartKey, setRestartKey] = useState(0);
   const active = inView && visible && !hovered && !reduced;

   useEffect(() => {
      if (!active) return;
      const id = window.setInterval(
         () => setStep((s) => (s + 1) % steps),
         interval
      );
      return () => window.clearInterval(id);
   }, [active, steps, interval, restartKey]);

   const jump = (next: number) => {
      setStep(next % steps);
      setRestartKey((k) => k + 1);
   };

   return {
      step,
      jump,
      rootProps: { ref, ...hoverProps },
   };
};
