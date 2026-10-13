import { useEffect, useRef, useState } from "react";

// keeps a busy signal on for at least `minMs` from when it started, so quick work still gets visible feedback.
const useMinimumActive = (active: boolean, minMs = 700): boolean => {
   const [shown, setShown] = useState(active);
   const startedAt = useRef(0);

   useEffect(() => {
      if (active) {
         startedAt.current = Date.now();
         setShown(true);
         return;
      }
      const remaining = startedAt.current + minMs - Date.now();
      if (remaining <= 0) {
         setShown(false);
         return;
      }
      const timer = setTimeout(() => setShown(false), remaining);
      return () => clearTimeout(timer);
   }, [active, minMs]);

   return shown;
};

export default useMinimumActive;
