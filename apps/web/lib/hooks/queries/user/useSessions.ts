import { listSessions, revokeOtherSessions, revokeSession } from "@/lib/auth";
import useApiMutation, {
   type MutationScope,
} from "@/lib/hooks/mutations/useApiMutation";
import { queryKeys } from "@/lib/query-keys";
import { useUserId } from "@/lib/stores/session-store";
import { useQuery } from "@tanstack/react-query";

type Session = Awaited<ReturnType<typeof listSessions>>[number];

const newestFirst = (a: Session, b: Session): number =>
   new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

const sessionsQuery = (userId: string) => ({
   queryKey: queryKeys.sessions(userId),
   queryFn: async (): Promise<Session[]> => {
      const sessions = await listSessions(userId);
      return [...sessions].sort(newestFirst);
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
         const { error } = await revokeSession(token, userId);
         if (error) throw new Error(error);
      },
      success: "Signed out on that device",
      invalidates: sessionsOf,
      failure: "Couldn't sign that device out",
   });

const useRevokeOtherSessions = () =>
   useApiMutation<void, Error, void>({
      request: async (_, { userId }) => {
         const { error } = await revokeOtherSessions(userId);
         if (error) throw new Error(error);
      },
      success: "Signed out everywhere else",
      invalidates: sessionsOf,
      failure: "Couldn't sign the other devices out",
   });

export { sessionsQuery, useRevokeOtherSessions, useRevokeSession, useSessions };
export type { Session };
