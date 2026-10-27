import { errorMessage } from "@/lib/api";
import { useState } from "react";

const useRequestError = () => {
   const [error, setError] = useState<string | null>(null);
   const fail = (failure: unknown) => setError(errorMessage(failure));
   const attempt = <TData>(
      onSuccess: (data: TData) => void,
      onError?: () => void
   ) => {
      setError(null);
      return {
         onSuccess,
         onError: (failure: unknown) => {
            onError?.();
            fail(failure);
         },
      };
   };
   return { error, clear: () => setError(null), fail, attempt };
};

export default useRequestError;
