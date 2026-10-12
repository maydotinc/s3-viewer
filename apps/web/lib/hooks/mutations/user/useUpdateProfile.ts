import { accountFetchOptions, authClient } from "@/lib/auth";
import useApiMutation from "@/lib/hooks/mutations/useApiMutation";
import { GENERIC_ERROR_MESSAGE } from "@s3-viewer/types";

type ProfileUpdate = { name: string };

const useUpdateProfile = () =>
   useApiMutation<void, Error, ProfileUpdate>({
      request: async ({ name }, { userId }) => {
         const { error } = await authClient.updateUser({
            name,
            fetchOptions: accountFetchOptions(userId),
         });
         if (error) throw new Error(error.message ?? GENERIC_ERROR_MESSAGE);
      },
      success: "Name updated",
      failure: "Couldn't update your name",
   });

export default useUpdateProfile;
