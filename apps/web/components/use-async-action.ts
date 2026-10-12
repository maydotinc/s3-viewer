import { useRef, useState } from "react";

const useAsyncAction = (onError?: (error: unknown) => void) => {
   const [pending, setPending] = useState(false);
   const active = useRef(false);
   const run = async (action: () => Promise<unknown>): Promise<void> => {
      if (active.current) return;
      active.current = true;
      setPending(true);
      try {
         await action();
      } catch (error) {
         if (!onError) throw error;
         onError(error);
      } finally {
         active.current = false;
         setPending(false);
      }
   };
   return { pending, run };
};

export default useAsyncAction;
