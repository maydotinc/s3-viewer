import { useEffect, useState } from "react";

const useDebouncedValue = <T>(value: T, delayMs: number) => {
   const [debounced, setDebounced] = useState(value);
   useEffect(() => {
      const timer = setTimeout(() => setDebounced(value), delayMs);
      return () => clearTimeout(timer);
   }, [value, delayMs]);
   return debounced;
};

export { useDebouncedValue };
