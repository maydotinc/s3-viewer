import type { BucketTarget } from "@/lib/types";
import type {
   S3ObjectSettings,
   UpdateObjectSettingsInput,
} from "@s3-viewer/types";
import useObjectMutation, {
   forgetTouched,
   sendObjectMutation,
} from "./useObjectMutation";

type ObjectSettingsFields = Omit<
   UpdateObjectSettingsInput,
   "serverId" | "bucketName" | "objectKey" | "expectedUserId" | "expectedETag"
>;

type UpdateObjectSettingsArgs = ObjectSettingsFields &
   BucketTarget & {
      objectKey: string;
      expectedETag: string;
   };

const useUpdateObjectSettings = () =>
   useObjectMutation({
      mutationFn: ({
         userId,
         serverId,
         bucketName,
         ...fields
      }: UpdateObjectSettingsArgs) =>
         sendObjectMutation<S3ObjectSettings>(
            "patch",
            { userId, serverId, bucketName },
            "/settings",
            fields
         ),
      settle: forgetTouched(({ objectKey }) => ({ changed: [objectKey] })),
   });

export default useUpdateObjectSettings;
