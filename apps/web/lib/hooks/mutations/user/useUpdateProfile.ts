import { authClient } from "@/lib/auth";
import { errorMessage } from "@/lib/api";
import { GENERIC_ERROR_MESSAGE } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation } from "@tanstack/react-query";

type ProfileUpdate = { name: string };

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
