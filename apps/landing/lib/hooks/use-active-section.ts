import { useEffect, useState } from "react";

const OFFSET = 140;

export const useActiveSection = (ids: string[]) => {
   const [active, setActive] = useState<string | null>(ids[0] ?? null);

   useEffect(() => {
      if (ids.length === 0) return;
      let rafId = 0;
      let ticking = false;

      const compute = () => {
         let current = ids[0];
         for (const id of ids) {
            const el = document.getElementById(id);
            if (!el) continue;
            if (el.getBoundingClientRect().top - OFFSET > 0) break;
            current = id;
         }
         setActive(current ?? null);
         ticking = false;
      };

      const onScroll = () => {
         if (ticking) return;
         rafId = requestAnimationFrame(compute);
         ticking = true;
      };

      compute();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });

      return () => {
         window.removeEventListener("scroll", onScroll);
         window.removeEventListener("resize", onScroll);
         cancelAnimationFrame(rafId);
      };
   }, [ids]);

   return active;
};
