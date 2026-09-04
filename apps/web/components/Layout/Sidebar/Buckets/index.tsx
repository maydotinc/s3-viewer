import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import useServers from "@/lib/hooks/queries/server/useServers";
import { folderHref } from "@/lib/utils/s3/paths";
import { SITE_PATHS } from "@s3-viewer/types";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { cn } from "@s3-viewer/ui/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Folder } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useRef } from "react";

const ROW_HEIGHT = 36;
const ROW_GAP = 4;

const BucketList = () => {
   const router = useRouter();
   const { currentServer } = useServers();
   const { buckets, isBucketsLoading, bucketsError } = useBuckets();
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

   if (!currentServer) return null;

   if (isBucketsLoading) {
      return (
         <div className="flex flex-col gap-1">
            {Array.from({ length: 4 }).map((_, index) => (
               <Skeleton key={index} className="h-9 w-full rounded-lg" />
            ))}
         </div>
      );
   }

   if (bucketsError) {
      return (
         <p
            role="alert"
            className="flex h-9 items-center px-2 text-sm text-viewertextred"
         >
            <span className="min-w-0 truncate">{bucketsError.message}</span>
         </p>
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
         className="min-h-0 overflow-y-auto"
      >
         <ul
            className="relative w-full"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
         >
            {virtualizer.getVirtualItems().map((item) => {
               const bucket = buckets[item.index];
               if (!bucket) return null;
               return (
                  <li
                     key={bucket.name}
                     className="absolute left-0 top-0 w-full"
                     style={{
                        transform: `translateY(${item.start}px)`,
                        height: `${item.size}px`,
                     }}
                  >
                     <Link
                        href={folderHref(bucket.name, [])}
                        aria-current={
                           selected === bucket.name ? "page" : undefined
                        }
                        className={cn(
                           "flex h-9 items-center gap-2.5 rounded-lg px-2 text-sm text-viewertext transition-colors duration-150 hover:bg-viewergray/70",
                           selected === bucket.name &&
                              "bg-viewergray font-medium text-viewerblack hover:bg-viewergray"
                        )}
                     >
                        <Folder
                           aria-hidden="true"
                           className="size-4 shrink-0 text-viewertext"
                        />
                        <span className="min-w-0 truncate">{bucket.name}</span>
                     </Link>
                  </li>
               );
            })}
         </ul>
      </nav>
   );
};

export default BucketList;
