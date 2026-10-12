import { useInView } from "@/lib/hooks/use-in-view";
import { usePageVisible } from "@/lib/hooks/use-page-visible";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { useEffect, useState } from "react";
import { useHoverPause } from "./use-hover-pause";

type Options = { steps: number; interval: number };

// cycles through `steps` while the figure is on screen, the tab is visible,
// and the viewer has not paused it (hover with a mouse, or the pause button).
export const useAutoplay = ({ steps, interval }: Options) => {
   const [ref, inView] = useInView<HTMLDivElement>();
   const { hovered, hoverProps } = useHoverPause();
   const visible = usePageVisible();
   const reduced = useReducedMotion();
   const [paused, setPaused] = useState(false);
   const [step, setStep] = useState(0);
   const [restartKey, setRestartKey] = useState(0);
   const active = inView && visible && !hovered && !paused && !reduced;

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
      paused,
      togglePaused: () => setPaused((p) => !p),
      rootProps: { ref, ...hoverProps },
   };
};
