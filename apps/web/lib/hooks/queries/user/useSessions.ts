import { authClient } from "@/lib/auth";
import { queryKeys } from "@/lib/queryKeys";
import { useUserId } from "@/lib/stores/sessionStore";
import { toastError } from "@/lib/utils/toast";
import { GENERIC_ERROR_MESSAGE } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// better-auth owns this shape; deriving it keeps the card honest if the
// library adds or renames a field
type Sessions = NonNullable<
   Awaited<ReturnType<typeof authClient.listSessions>>["data"]
>;
type Session = Sessions[number];

type AuthError = { message?: string | undefined };

const failed = (error: AuthError): Error =>
   new Error(error.message ?? GENERIC_ERROR_MESSAGE);

const newestFirst = (a: Session, b: Session): number =>
   new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

const useSessions = () => {
   const userId = useUserId();

   return useQuery({
      queryKey: queryKeys.sessions(userId),
      queryFn: async (): Promise<Session[]> => {
         const { data, error } = await authClient.listSessions();
         if (error) throw failed(error);
         return [...(data ?? [])].sort(newestFirst);
      },
      enabled: Boolean(userId),
   });
};

// revoking is what makes the list wrong, so both mutations refetch it rather
// than trimming the cache: the server decides which sessions survived
const useInvalidateSessions = () => {
   const queryClient = useQueryClient();
   const userId = useUserId();
   return () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions(userId) });
};

const useRevokeSession = () => {
   const invalidate = useInvalidateSessions();

   return useMutation<void, Error, { token: string }>({
      mutationFn: async ({ token }) => {
         const { error } = await authClient.revokeSession({ token });
         if (error) throw failed(error);
      },
      onSuccess: () => {
         toast.success("Signed out on that device");
         void invalidate();
      },
      onError: toastError("Couldn't sign that device out"),
   });
};

const useRevokeOtherSessions = () => {
   const invalidate = useInvalidateSessions();

   return useMutation<void, Error, void>({
      mutationFn: async () => {
         const { error } = await authClient.revokeOtherSessions();
         if (error) throw failed(error);
      },
      onSuccess: () => {
         toast.success("Signed out everywhere else");
         void invalidate();
      },
      onError: toastError("Couldn't sign the other devices out"),
   });
};

export { useRevokeOtherSessions, useRevokeSession, useSessions };
export type { Session };
