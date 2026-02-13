import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import { cn } from "@s3-viewer/ui/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Folder } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useRef } from "react";

const BucketList = () => {
   const router = useRouter();
   const containerRef = useRef<HTMLDivElement>(null);
   const { buckets } = useBuckets();
   const virtualizer = useVirtualizer({
      count: buckets.length,
      getScrollElement: () => containerRef.current,
      estimateSize: () => 40,
   });
   const selectedBucket =
      router.pathname.startsWith("/buckets") && router.query.slug
         ? (router.query.slug[0] as string)
         : null;
   const virtualItems = virtualizer.getVirtualItems();

   return (
      <div className="w-full overflow-auto px-2 pb-2" ref={containerRef}>
         <div
            className="relative mb-2"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
         >
            {virtualItems.map((virtualItem) => {
               const bucketCard = buckets[virtualItem.index];
               return (
                  <div
                     className="absolute top-0 left-0 w-full flex mt-1 first:mt-0"
                     style={{
                        transform: `translateY(${virtualItem.start}px)`,
                        height: `${virtualItem.size}px`,
                     }}
                     key={virtualItem.key}
                     data-index={virtualItem.index}
                  >
                     <Link
                        href={`/buckets/${bucketCard?.Name}`}
                        className={cn(
                           "flex-1 flex gap-2 p-2 rounded-md items-center justify-start text-viewertext cursor-pointer hover:text-viewerblue hover:bg-viewergray",
                           selectedBucket === bucketCard?.Name &&
                           "bg-viewergray"
                        )}
                     >
                        <Folder className="size-4 text-viewerblue" />
                        <span className="text-inherit truncate max-w-[150px]">
                           {bucketCard?.Name}
                        </span>
                     </Link>
                  </div>
               );
            })}
         </div>
      </div>
   );
};

export default BucketList;
