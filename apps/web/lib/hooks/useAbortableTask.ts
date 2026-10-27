import { useEffect, useMemo, useRef } from "react";

type AbortableTask = {
   start: () => AbortSignal;
   cancel: () => void;
   ifMounted: (then: () => void) => void;
};

const useAbortableTask = (): AbortableTask => {
   const run = useRef<AbortController | null>(null);
   const alive = useRef(true);

   useEffect(() => {
      alive.current = true;
      return () => {
         alive.current = false;
         run.current?.abort();
      };
   }, []);

   return useMemo(
      () => ({
         start: () => {
            const controller = new AbortController();
            run.current = controller;
            return controller.signal;
         },
         cancel: () => run.current?.abort(),
         ifMounted: (then: () => void) => {
            if (alive.current) then();
         },
      }),
      []
   );
};

export { useAbortableTask };
