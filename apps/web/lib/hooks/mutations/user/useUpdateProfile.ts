import { authClient } from "@/lib/auth";
import { errorMessage } from "@/lib/api";
import { GENERIC_ERROR_MESSAGE } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation } from "@tanstack/react-query";

type ProfileUpdate = { name: string };

/**
 * Updates the signed-in user's name through Better Auth — the only profile
 * field there is. The client refetches `useSession()` on its own after
 * `/update-user`, so every name and avatar on screen follows without a
 * reload (the avatar is generated from the name).
 */
const useUpdateProfile = () =>
   useMutation<void, Error, ProfileUpdate>({
      mutationFn: async ({ name }) => {
         const { error } = await authClient.updateUser({ name });
         if (error) throw new Error(error.message ?? GENERIC_ERROR_MESSAGE);
      },
      onSuccess: () => {
         toast.success("Name updated");
      },
      onError: (error) => {
         toast.error("Couldn't update your name", {
            description: errorMessage(error),
         });
      },
   });

export default useUpdateProfile;
