import { accountFetchOptions, authClient } from "@/lib/auth";
import useApiMutation, {
   type MutationScope,
} from "@/lib/hooks/mutations/useApiMutation";
import { queryKeys } from "@/lib/query-keys";
import { useUserId } from "@/lib/stores/session-store";
import { GENERIC_ERROR_MESSAGE } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";

type Sessions = NonNullable<
   Awaited<ReturnType<typeof authClient.listSessions>>["data"]
>;
type Session = Sessions[number];

type AuthError = { message?: string | undefined };

const failed = (error: AuthError): Error =>
   new Error(error.message ?? GENERIC_ERROR_MESSAGE);

const newestFirst = (a: Session, b: Session): number =>
   new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

const sessionsQuery = (userId: string) => ({
   queryKey: queryKeys.sessions(userId),
   queryFn: async (): Promise<Session[]> => {
      const { data, error } = await authClient.listSessions({
         fetchOptions: accountFetchOptions(userId),
      });
      if (error) throw failed(error);
      return [...(data ?? [])].sort(newestFirst);
   },
});

const useSessions = () => {
   const userId = useUserId();
   return useQuery({ ...sessionsQuery(userId), enabled: Boolean(userId) });
};

const sessionsOf = ({ scope }: { scope: MutationScope }) => [
   queryKeys.sessions(scope.userId),
];

const useRevokeSession = () =>
   useApiMutation<void, Error, { token: string }>({
      request: async ({ token }, { userId }) => {
         const { error } = await authClient.revokeSession({
            token,
            fetchOptions: accountFetchOptions(userId),
         });
         if (error) throw failed(error);
      },
      success: "Signed out on that device",
      invalidates: sessionsOf,
      failure: "Couldn't sign that device out",
   });

const useRevokeOtherSessions = () =>
   useApiMutation<void, Error, void>({
      request: async (_, { userId }) => {
         const { error } = await authClient.revokeOtherSessions({
            fetchOptions: accountFetchOptions(userId),
         });
         if (error) throw failed(error);
      },
      success: "Signed out everywhere else",
      invalidates: sessionsOf,
      failure: "Couldn't sign the other devices out",
   });

export { sessionsQuery, useRevokeOtherSessions, useRevokeSession, useSessions };
export type { Session };
