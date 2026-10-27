import { api, objectMutationPath } from "@/lib/api";
import type { BucketTarget, KeyChangeInput } from "@/lib/types";
import type { BatchSummary } from "@/lib/utils/s3/batch";
import {
   useMutation,
   useQueryClient,
   type QueryClient,
} from "@tanstack/react-query";
import { forgetKeys, forgetObjects, noKey, type KeyMatch } from "./invalidate";

// undefined when the request failed, so nothing it touched is known to be gone
type Outcome<TData> = { data: TData } | undefined;

type Settle<TInput, TData> = (
   input: TInput,
   queryClient: QueryClient,
   outcome: Outcome<TData>
) => void;

type Touched<TKey> = { changed?: TKey; removed?: TKey };

const useObjectMutation = <TInput extends BucketTarget, TData>({
   mutationFn,
   onSuccess,
   settle,
}: {
   mutationFn: (input: TInput) => Promise<TData>;
   onSuccess?: (data: TData, input: TInput, queryClient: QueryClient) => void;
   settle?: Settle<TInput, TData>;
}) => {
   const queryClient = useQueryClient();
   return useMutation({
      mutationFn,
      onSuccess: (data: TData, input: TInput) =>
         onSuccess?.(data, input, queryClient),
      onSettled: (data: TData | undefined, error: Error | null, input) =>
         settle?.(
            input,
            queryClient,
            error ? undefined : { data: data as TData }
         ),
   });
};

const forgetTouched =
   <TInput extends BucketTarget, TData>(
      touched: (
         input: TInput,
         outcome: Outcome<TData>
      ) => Touched<readonly string[]>
   ): Settle<TInput, TData> =>
   (input, queryClient, outcome) => {
      const { changed = [], removed } = touched(input, outcome);
      forgetKeys(
         queryClient,
         input.userId,
         input.serverId,
         input.bucketName,
         changed,
         removed
      );
   };

const forgetMatching =
   <TInput extends BucketTarget, TData>(
      touched: (input: TInput, outcome: Outcome<TData>) => Touched<KeyMatch>
   ): Settle<TInput, TData> =>
   (input, queryClient, outcome) => {
      const { changed = noKey, removed } = touched(input, outcome);
      forgetObjects(
         queryClient,
         input.userId,
         input.serverId,
         input.bucketName,
         changed,
         removed
      );
   };

// targets storage did not confirm are reset rather than removed, so an open view of one refetches
const confirmedTargets = <TTarget>(
   targets: readonly TTarget[],
   idOf: (target: TTarget) => string,
   outcome: Outcome<BatchSummary<TTarget>>
) => {
   const missed = new Set(
      outcome
         ? [...outcome.data.failed, ...outcome.data.unsent].map(idOf)
         : targets.map(idOf)
   );
   return {
      confirmed: targets.filter((target) => !missed.has(idOf(target))),
      unconfirmed: targets.filter((target) => missed.has(idOf(target))),
   };
};

const sendObjectMutation = <TResult>(
   method: "post" | "patch",
   { userId, serverId, bucketName }: BucketTarget,
   suffix: string,
   body: object
): Promise<TResult> =>
   api[method]<TResult>(objectMutationPath(serverId, bucketName, suffix), {
      expectedUserId: userId,
      ...body,
   });

const postKeyChange =
   <TResult, TInput extends KeyChangeInput = KeyChangeInput>(
      action: "copy" | "rename"
   ) =>
   ({ userId, serverId, bucketName, ...body }: TInput) =>
      sendObjectMutation<TResult>(
         "post",
         { userId, serverId, bucketName },
         `/${action}`,
         body
      );

export default useObjectMutation;
export {
   confirmedTargets,
   forgetMatching,
   forgetTouched,
   postKeyChange,
   sendObjectMutation,
};
