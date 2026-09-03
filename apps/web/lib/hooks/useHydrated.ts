import { useEffect, useState } from "react";

const useHydrated = (): boolean => {
   const [hydrated, setHydrated] = useState(false);
   useEffect(() => setHydrated(true), []);
   return hydrated;
};

export { useHydrated };
