import { MAX_PAGE_SIZE } from "@s3-viewer/types";
import { api, qs, serverPath } from "@/lib/api";
import useCursorQuery, { pageCursor } from "@/lib/hooks/queries/useCursorQuery";
import { queryKeys } from "@/lib/query-keys";
import { useUserId } from "@/lib/stores/session-store";
import type { MemberPage } from "@s3-viewer/types";
import { useEffect } from "react";

const PAGE_SIZE = MAX_PAGE_SIZE;

const pageMembers = (page: MemberPage) => page.members;

const useMembers = (serverId: string) => {
   const userId = useUserId();

   const { items: members, ...pages } = useCursorQuery({
      queryKey: queryKeys.members(userId, serverId),
      queryFn: (cursor, signal) =>
         api.get<MemberPage>(
            `${serverPath(serverId)}/members${qs({
               cursor,
               limit: PAGE_SIZE,
            })}`,
            signal
         ),
      select: pageMembers,
      nextCursor: pageCursor,
      enabled: Boolean(userId && serverId),
      refetchOnWindowFocus: true,
   });

   return { members, ...pages };
};

const useAllMembers = (serverId: string) => {
   const query = useMembers(serverId);
   const { hasNextPage, isFetchingNextPage, error, fetchNextPage } = query;
   useEffect(() => {
      if (hasNextPage && !isFetchingNextPage && !error)
         void fetchNextPage({ cancelRefetch: false });
   }, [hasNextPage, isFetchingNextPage, error, fetchNextPage]);
   const walking = hasNextPage && !error;
   return { ...query, isLoading: query.isLoading || walking };
};

export default useMembers;
export { useAllMembers };
export type { MemberPage };
