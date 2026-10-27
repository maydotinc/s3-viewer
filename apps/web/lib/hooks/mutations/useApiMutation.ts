import { ApiError } from "@/lib/api";
import { getSessionScope } from "@/lib/stores/session-scope";
import useSessionStore from "@/lib/stores/session-store";
import { toastError } from "@/lib/utils/toast";
import { toast } from "@s3-viewer/ui/components/toast";
import {
   useMutation,
   useQueryClient,
   type QueryClient,
   type MutateOptions,
   type UseMutateFunction,
   type UseMutateAsyncFunction,
   type UseMutationResult,
} from "@tanstack/react-query";
import { useCallback } from "react";
import { ACCOUNT_CHANGED_MESSAGE, ErrorCode } from "@s3-viewer/shared";

type MutationScope = Readonly<{ userId: string; serverId: string }>;

type ScopedVariables<TVariables> = {
   variables: TVariables;
   scope: MutationScope;
};

type QueryKeyList = readonly (readonly unknown[])[];

type Settled<TVariables> = {
   variables: TVariables;
   scope: MutationScope;
   queryClient: QueryClient;
};

type Succeeded<TData, TVariables> = Settled<TVariables> & { data: TData };
type Failed<TError, TVariables> = Settled<TVariables> & { error: TError };

type ApiMutationOptions<TData, TError, TVariables> = {
   request: (variables: TVariables, scope: MutationScope) => Promise<TData>;
   success?: string | ((result: Succeeded<TData, TVariables>) => unknown);
   failure?: string | ((failure: Failed<TError, TVariables>) => void);
   removes?: (result: Succeeded<TData, TVariables>) => QueryKeyList;
   refreshes?: (result: Succeeded<TData, TVariables>) => QueryKeyList;
   invalidates?: (result: Succeeded<TData, TVariables>) => QueryKeyList;
};

const invalidateOn =
   <TError extends { status: number }, TVariables>(
      status: number,
      keys: (failure: Failed<TError, TVariables>) => QueryKeyList
   ) =>
   (failure: Failed<TError, TVariables>): void => {
      if (failure.error.status !== status) return;
      for (const queryKey of keys(failure))
         void failure.queryClient.invalidateQueries({ queryKey });
   };

const useApiMutation = <TData, TError = ApiError, TVariables = void>({
   request,
   success,
   failure,
   removes,
   refreshes,
   invalidates,
}: ApiMutationOptions<TData, TError, TVariables>): UseMutationResult<
   TData,
   TError,
   TVariables,
   MutationScope
> => {
   const queryClient = useQueryClient();
   const mutation = useMutation<
      TData,
      TError,
      ScopedVariables<TVariables>,
      MutationScope
   >({
      mutationFn: ({ variables, scope }) => {
         if (
            !scope.userId ||
            useSessionStore.getState().userId !== scope.userId
         )
            return Promise.reject(
               new ApiError(
                  403,
                  ACCOUNT_CHANGED_MESSAGE,
                  ErrorCode.ACCOUNT_CHANGED
               )
            );
         return request(variables, scope);
      },
      onMutate: ({ scope }) => scope,
      onSuccess: async (data, { variables, scope }) => {
         const result = { data, variables, scope, queryClient };
         for (const queryKey of removes?.(result) ?? [])
            queryClient.removeQueries({ queryKey });
         const refreshed = refreshes?.(result) ?? [];
         if (refreshed.length > 0)
            await Promise.all(
               refreshed.map((queryKey) =>
                  queryClient.invalidateQueries({ queryKey })
               )
            );
         if (typeof success === "function") await success(result);
         else if (success) toast.success(success);
         for (const queryKey of invalidates?.(result) ?? [])
            void queryClient.invalidateQueries({ queryKey });
      },
      onError: (error, { variables, scope }) => {
         if (typeof failure === "function")
            failure({ error, variables, scope, queryClient });
         else if (failure) toastError(failure)(error);
      },
   });

   const { mutate: runMutation, mutateAsync: runMutationAsync } = mutation;
   const mutate: UseMutateFunction<TData, TError, TVariables, MutationScope> =
      useCallback(
         (variables, options) =>
            runMutation(
               { variables, scope: getSessionScope() },
               unwrapOptions(options)
            ),
         [runMutation]
      );
   const mutateAsync: UseMutateAsyncFunction<
      TData,
      TError,
      TVariables,
      MutationScope
   > = useCallback(
      (variables, options) =>
         runMutationAsync(
            { variables, scope: getSessionScope() },
            unwrapOptions(options)
         ),
      [runMutationAsync]
   );

   return {
      ...mutation,
      variables: mutation.variables?.variables,
      mutate,
      mutateAsync,
   } as UseMutationResult<TData, TError, TVariables, MutationScope>;
};

const unwrapOptions = <TData, TError, TVariables>(
   options?: MutateOptions<TData, TError, TVariables, MutationScope>
): MutateOptions<
   TData,
   TError,
   ScopedVariables<TVariables>,
   MutationScope
> => ({
   onSuccess: (data, { variables }, scope) =>
      options?.onSuccess?.(data, variables, scope),
   onError: (error, { variables }, scope) =>
      options?.onError?.(error, variables, scope),
   onSettled: (data, error, { variables }, scope) =>
      options?.onSettled?.(data, error, variables, scope),
});

export default useApiMutation;
export { invalidateOn };
export type { MutationScope };
