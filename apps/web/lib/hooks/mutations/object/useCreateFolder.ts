import type { BucketTarget } from "@/lib/types";
import useObjectMutation, {
   forgetTouched,
   sendObjectMutation,
} from "./useObjectMutation";

const useCreateFolder = () =>
   useObjectMutation({
      mutationFn: ({
         folderKey,
         ...target
      }: BucketTarget & { folderKey: string }) =>
         sendObjectMutation<{ key: string }>("post", target, "/folders", {
            folderKey,
         }),
      settle: forgetTouched(({ folderKey }) => ({ changed: [folderKey] })),
   });

export default useCreateFolder;
