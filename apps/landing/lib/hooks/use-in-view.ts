import { useEffect, useRef, useState } from "react";

export const useInView = <T extends Element>(rootMargin = "0px") => {
   const ref = useRef<T>(null);
   const [inView, setInView] = useState(false);

   useEffect(() => {
      const el = ref.current;
      if (!el) return;
      const observer = new IntersectionObserver(
         ([entry]) => setInView(entry?.isIntersecting ?? false),
         { rootMargin }
      );
      observer.observe(el);
      return () => observer.disconnect();
   }, [rootMargin]);

   return [ref, inView] as const;
};
