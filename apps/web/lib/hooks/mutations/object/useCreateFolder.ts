import type { BucketTarget } from "@/lib/types";
import useObjectMutation, {
   forgetTouched,
   sendObjectMutation,
} from "./object-mutation";

const useCreateFolder = () =>
   useObjectMutation({
      mutationFn: ({
         folderKey,
         ...target
      }: BucketTarget & { folderKey: string }) =>
         sendObjectMutation<{ key: string }>("post", target, "/folders", {
            folderKey,
         }),
      settle: forgetTouched(({ folderKey }) => [folderKey]),
   });

export default useCreateFolder;
