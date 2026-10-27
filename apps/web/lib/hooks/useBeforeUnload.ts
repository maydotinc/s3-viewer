import { useEffect } from "react";

const useBeforeUnload = (active: boolean): void => {
   useEffect(() => {
      if (!active) return;
      const warn = (event: BeforeUnloadEvent) => event.preventDefault();
      window.addEventListener("beforeunload", warn);
      return () => window.removeEventListener("beforeunload", warn);
   }, [active]);
};

export { useBeforeUnload };
