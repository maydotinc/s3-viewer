import { authClient } from "@/lib/auth";
import { errorMessage } from "@/lib/api";
import { GENERIC_ERROR_MESSAGE } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation } from "@tanstack/react-query";

type ProfileUpdate = { name?: string; image?: string | null };

const messages = (update: ProfileUpdate) => {
   if (update.image === null) {
      return { success: "Photo removed", failure: "Couldn't remove the photo" };
   }
   if (update.image !== undefined) {
      return { success: "Photo updated", failure: "Couldn't update the photo" };
   }
   return { success: "Name updated", failure: "Couldn't update your name" };
};

/**
 * Updates the signed-in user's name or picture through Better Auth. The
 * client refetches `useSession()` on its own after `/update-user`, so every
 * avatar and name on screen follows without a reload.
 */
const useUpdateProfile = () =>
   useMutation<void, Error, ProfileUpdate>({
      mutationFn: async (update) => {
         const { error } = await authClient.updateUser(update);
         if (error) throw new Error(error.message ?? GENERIC_ERROR_MESSAGE);
      },
      onSuccess: (_data, update) => {
         toast.success(messages(update).success);
      },
      onError: (error, update) => {
         toast.error(messages(update).failure, {
            description: errorMessage(error),
         });
      },
   });

export default useUpdateProfile;
export type { ProfileUpdate };
