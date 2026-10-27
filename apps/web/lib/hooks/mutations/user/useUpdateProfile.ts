import { updateProfileName } from "@/lib/auth";
import useApiMutation from "@/lib/hooks/mutations/useApiMutation";

type ProfileUpdate = { name: string };

const useUpdateProfile = () =>
   useApiMutation<void, Error, ProfileUpdate>({
      request: async ({ name }, { userId }) => {
         const { error } = await updateProfileName(name, userId);
         if (error) throw new Error(error);
      },
      success: "Name updated",
      failure: "Couldn't update your name",
   });

export default useUpdateProfile;
