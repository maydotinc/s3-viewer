import { api, objectMutationPath } from "@/lib/api";
import type { BucketTarget, KeyChangeInput } from "@/lib/types";
import {
   useMutation,
   useQueryClient,
   type QueryClient,
} from "@tanstack/react-query";
import { forgetKeys, forgetObjects } from "./invalidate";

type Settle<TInput> = (input: TInput, queryClient: QueryClient) => void;

const useObjectMutation = <TInput extends BucketTarget, TData>({
   mutationFn,
   onSuccess,
   settle,
}: {
   mutationFn: (input: TInput) => Promise<TData>;
   onSuccess?: (data: TData, input: TInput, queryClient: QueryClient) => void;
   settle?: Settle<TInput>;
}) => {
   const queryClient = useQueryClient();
   return useMutation({
      mutationFn,
      onSuccess: (data: TData, input: TInput) =>
         onSuccess?.(data, input, queryClient),
      onSettled: (_result: TData | undefined, _error: Error | null, input) =>
         settle?.(input, queryClient),
   });
};

const forgetTouched =
   <TInput extends BucketTarget>(
      touched: (input: TInput) => readonly string[]
   ): Settle<TInput> =>
   (input, queryClient) =>
      forgetKeys(
         queryClient,
         input.userId,
         input.serverId,
         input.bucketName,
         touched(input)
      );

const forgetMatching =
   <TInput extends BucketTarget>(
      matches: (input: TInput) => (objectKey: string) => boolean
   ): Settle<TInput> =>
   (input, queryClient) =>
      forgetObjects(
         queryClient,
         input.userId,
         input.serverId,
         input.bucketName,
         matches(input)
      );

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

const keyChangeTouched = ({ objectKey, newObjectKey }: KeyChangeInput) => [
   objectKey,
   newObjectKey,
];

export default useObjectMutation;
export {
   forgetMatching,
   forgetTouched,
   keyChangeTouched,
   postKeyChange,
   sendObjectMutation,
};
