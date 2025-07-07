import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronRightIcon, Folder } from "lucide-react";
import { useRef } from "react";

const BucketList = () => {
   const containerRef = useRef<HTMLDivElement>(null);
   const { buckets, isBucketsLoading, bucketsError } = useBuckets();
   const virtualizer = useVirtualizer({
      count: buckets.length,
      getScrollElement: () => containerRef.current,
      estimateSize: () => 40,
   });

   const virtualItems = virtualizer.getVirtualItems();

   return (
      <div className="w-full overflow-auto px-2" ref={containerRef}>
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
                     <div className="flex-1 flex gap-2 justify-between items-start">
                        <div className="flex gap-2 items-center">
                           <Folder className="size-4 text-viewerblue" />
                           <span className="text-viewertext">
                              {bucketCard?.Name}
                           </span>
                        </div>
                        <ChevronRightIcon className="size-4" />
                     </div>
                  </div>
               );
            })}
         </div>
      </div>
   );
};

export default BucketList;
