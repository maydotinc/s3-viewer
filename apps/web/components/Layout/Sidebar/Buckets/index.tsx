import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Folder } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

const BucketList = () => {
   const containerRef = useRef<HTMLDivElement>(null);
   const { buckets } = useBuckets();
   const virtualizer = useVirtualizer({
      count: buckets.length,
      getScrollElement: () => containerRef.current,
      estimateSize: () => 40,
   });
   const virtualItems = virtualizer.getVirtualItems();

   return (
      <div className="w-full overflow-auto px-2 pb-2" ref={containerRef}>
         <div
            className="relative"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
         >
            {virtualItems.map((virtualItem) => {
               const bucketCard = buckets[virtualItem.index];
               return (
                  <div
                     className="absolute top-0 left-0 w-full flex"
                     style={{
                        transform: `translateY(${virtualItem.start}px)`,
                        height: `${virtualItem.size}px`,
                     }}
                     key={virtualItem.key}
                     data-index={virtualItem.index}
                  >
                     <Link
                        href={`/buckets/${bucketCard?.Name}`}
                        className="flex-1 flex gap-2 p-2 rounded-md items-center justify-start text-viewertext cursor-pointer hover:text-viewerblue hover:bg-viewergray"
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
