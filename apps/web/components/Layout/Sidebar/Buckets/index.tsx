import FoldersOnlyLabel from "@/components/folders-only-label";
import InlineAlert from "@/components/inline-alert";
import { RetryButton } from "@/components/status-message";
import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import useCurrentServer from "@/lib/hooks/queries/server/useCurrentServer";
import { bucketEntryHref } from "@/lib/utils/s3/paths";
import { SITE_PATHS } from "@s3-viewer/types";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import { cn } from "@s3-viewer/ui/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Folder, FolderLock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useRef } from "react";

// an estimate only: rows are measured, since touch screens render them taller.
const ROW_HEIGHT = 36;
const ROW_GAP = 4;

const BucketList = () => {
   const router = useRouter();
   const { currentServer, isLoading: isServerLoading } = useCurrentServer();
   const { buckets, isBucketsLoading, bucketsError, isFetching, refetch } =
      useBuckets();
   const scrollRef = useRef<HTMLElement>(null);
   const virtualizer = useVirtualizer({
      count: buckets.length,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => ROW_HEIGHT,
      gap: ROW_GAP,
      overscan: 8,
   });
   const selected =
      router.pathname.startsWith(SITE_PATHS.buckets) &&
      Array.isArray(router.query.slug)
         ? router.query.slug[0]
         : null;

   if (isServerLoading || (currentServer && isBucketsLoading)) {
      return (
         <div
            aria-busy="true"
            className="flex min-h-0 flex-1 flex-col overflow-hidden [scrollbar-gutter:stable]"
         >
            <span className="sr-only">Loading buckets</span>
            <Skeleton className="h-9 shrink-0 rounded-lg pointer-coarse:h-11" />
         </div>
      );
   }

   if (!currentServer) return null;

   if (bucketsError) {
      return (
         <InlineAlert
            title="Couldn't load buckets"
            action={
               <RetryButton
                  size="sm"
                  retrying={isFetching}
                  onRetry={() => void refetch()}
               />
            }
         >
            {bucketsError.message}
         </InlineAlert>
      );
   }

   if (buckets.length === 0) {
      return (
         <p className="flex h-9 items-center px-2 text-sm text-viewerlighttext">
            No buckets yet
         </p>
      );
   }

   return (
      <nav
         ref={scrollRef}
         aria-label="Buckets"
         className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]"
      >
         <ul
            className="relative w-full"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
         >
            {virtualizer.getVirtualItems().map((item) => {
               const bucket = buckets[item.index];
               if (!bucket) return null;
               const Icon = bucket.folders === null ? Folder : FolderLock;
               const link = (
                  <Link
                     href={bucketEntryHref(bucket)}
                     aria-current={
                        selected === bucket.name ? "page" : undefined
                     }
                     className={cn(
                        "flex h-full items-center gap-2.5 rounded-lg px-2 text-sm text-viewertext transition-colors duration-150 hover:bg-viewergray/70",
                        selected === bucket.name &&
                           "bg-viewergray font-medium text-viewerblack hover:bg-viewergray"
                     )}
                  >
                     <Icon
                        aria-hidden="true"
                        className="size-4 shrink-0 text-viewertext"
                     />
                     <span className="min-w-0 truncate" title={bucket.name}>
                        {bucket.name}
                     </span>
                     {bucket.folders !== null && (
                        <span className="sr-only"> (folders only)</span>
                     )}
                  </Link>
               );
               return (
                  <li
                     key={bucket.name}
                     ref={virtualizer.measureElement}
                     data-index={item.index}
                     className="absolute left-0 top-0 h-9 w-full pointer-coarse:h-11"
                     style={{ transform: `translateY(${item.start}px)` }}
                  >
                     {bucket.folders === null ? (
                        link
                     ) : (
                        <SimpleTooltip
                           side="right"
                           label={<FoldersOnlyLabel folders={bucket.folders} />}
                        >
                           {link}
                        </SimpleTooltip>
                     )}
                  </li>
               );
            })}
         </ul>
      </nav>
   );
};

export default BucketList;
