import {
   useInfiniteQuery,
   type QueryClient,
   type QueryKey,
} from "@tanstack/react-query";
import { useMemo } from "react";

type CursorPage = { nextCursor: string | null };

type CursorQueryOptions<Page, Item, Cursor> = {
   queryKey: QueryKey;
   queryFn: (cursor: Cursor | null, signal: AbortSignal) => Promise<Page>;
   // keep this referentially stable (module scope) so the list only changes with the data.
   select: (page: Page) => Item[];
   // null once the listing is exhausted.
   nextCursor: (page: Page) => Cursor | null;
   enabled: boolean;
   retry?: boolean;
   staleTime?: number;
   refetchOnWindowFocus?: boolean;
   // a previous key's rows stay up while the next loads, only under this prefix so never another account's or server's.
   keepPreviousWithin?: QueryKey;
};

const NONE: never[] = [];

const startsWith = (key: QueryKey, prefix: QueryKey): boolean =>
   prefix.every((part, index) => key[index] === part);

const pageCursor = (page: CursorPage) => page.nextCursor;

type CursorQuerySource<Page, Cursor> = Pick<
   CursorQueryOptions<Page, unknown, Cursor>,
   "queryKey" | "queryFn"
>;

// warms the first page under the same key the hook reads, so a page that mounts next renders without a skeleton
const prefetchCursorQuery = <Page, Cursor = string>(
   queryClient: QueryClient,
   { queryKey, queryFn }: CursorQuerySource<Page, Cursor>
) =>
   queryClient.prefetchInfiniteQuery({
      queryKey,
      queryFn: ({ pageParam, signal }) =>
         queryFn(pageParam as Cursor | null, signal),
      initialPageParam: null as Cursor | null,
   });

const useCursorQuery = <Page, Item, Cursor = string>({
   queryKey,
   queryFn,
   select,
   nextCursor,
   keepPreviousWithin,
   ...options
}: CursorQueryOptions<Page, Item, Cursor>) => {
   const query = useInfiniteQuery({
      queryKey,
      // the context's page param is a conditional type tsc leaves unresolved for a generic cursor.
      queryFn: ({ pageParam, signal }) =>
         queryFn(pageParam as Cursor | null, signal),
      initialPageParam: null as Cursor | null,
      getNextPageParam: nextCursor,
      placeholderData: keepPreviousWithin
         ? (previous, previousQuery) =>
              previousQuery &&
              startsWith(previousQuery.queryKey, keepPreviousWithin)
                 ? previous
                 : undefined
         : undefined,
      ...options,
   });
   const { data } = query;
   const items = useMemo(
      () => (data ? data.pages.flatMap(select) : (NONE as Item[])),
      [data, select]
   );
   return {
      items,
      data,
      error: query.error,
      isLoading: query.isLoading,
      isFetching: query.isFetching,
      isPlaceholderData: query.isPlaceholderData,
      hasNextPage: query.hasNextPage,
      isFetchingNextPage: query.isFetchingNextPage,
      isFetchNextPageError: query.isFetchNextPageError,
      fetchNextPage: query.fetchNextPage,
      refetch: query.refetch,
   };
};

export default useCursorQuery;
export { pageCursor, prefetchCursorQuery };
