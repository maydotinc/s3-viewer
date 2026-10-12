import InlineAlert from "@/components/inline-alert";
import { Button } from "@s3-viewer/ui/components/button";

type FetchPage = (options: { cancelRefetch: false }) => Promise<unknown>;

type PagedQuery = {
   error: unknown;
   isFetchNextPageError: boolean;
   fetchNextPage: FetchPage;
   refetch: FetchPage;
};

const loadNext = ({
   error,
   isFetchNextPageError,
   fetchNextPage,
   refetch,
}: PagedQuery): Promise<unknown> =>
   (error && !isFetchNextPageError ? refetch : fetchNextPage)({
      cancelRefetch: false,
   });

type LoadMoreQuery = PagedQuery & {
   hasNextPage: boolean;
   isFetching: boolean;
   error: Error | null;
};

type ListPaginationProps = LoadMoreQuery & {
   label?: string;
   variant?: "inline" | "footer";
   disabled?: boolean;
};

const ListPagination = ({
   label = "Load more",
   variant = "inline",
   disabled,
   ...query
}: ListPaginationProps) => {
   const { hasNextPage, isFetching, error } = query;
   if (!hasNextPage && !error) return null;
   const button = (
      <Button
         type="button"
         variant={error || variant === "inline" ? "outline" : "ghost"}
         size="sm"
         className="shrink-0"
         loading={isFetching}
         disabled={disabled}
         onClick={() => void loadNext(query)}
      >
         {error ? "Try again" : label}
      </Button>
   );
   if (variant === "inline")
      return error ? (
         <InlineAlert className="self-stretch" action={button}>
            {error.message}
         </InlineAlert>
      ) : (
         button
      );
   return (
      <div className="flex min-h-12 items-center justify-center gap-2 border-t border-viewerborder px-4 py-1.5">
         {error && (
            <InlineAlert variant="plain" truncate>
               {error.message}
            </InlineAlert>
         )}
         {button}
      </div>
   );
};

export default ListPagination;
export { loadNext };
export type { LoadMoreQuery };
