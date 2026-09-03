import { PRODUCT_NAME } from "@s3-viewer/types";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";

const BUCKET_ROWS = 4;
const CARDS = 6;

const FullPageSkeleton = () => (
   <div
      className="flex h-dvh w-full flex-col"
      role="status"
      aria-busy="true"
      aria-label={`Loading ${PRODUCT_NAME}`}
   >
      <header className="flex h-[var(--header-height)] shrink-0 items-center justify-between gap-4 border-b border-viewerborder bg-viewergray px-4 sm:px-6 lg:px-10">
         <Skeleton className="h-6 w-[112px] sm:h-8 sm:w-[150px]" />
         <Skeleton className="h-11 w-11 rounded-full sm:w-36" />
      </header>

      <div className="flex min-h-0 flex-1">
         <aside className="hidden w-64 shrink-0 p-4 md:block">
            <div className="flex h-full flex-col gap-3 rounded-xl border border-viewerborder p-2">
               <Skeleton className="h-3 w-14" />
               <Skeleton className="h-[68px] w-full rounded-xl" />
               <Skeleton className="h-3 w-14" />
               <div className="flex flex-col gap-1">
                  {Array.from({ length: BUCKET_ROWS }, (_, index) => (
                     <Skeleton key={index} className="h-10 w-full rounded-md" />
                  ))}
               </div>
            </div>
         </aside>

         <main className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-[var(--header-height)] shrink-0 items-center justify-between gap-4 border-b border-viewerborder px-8">
               <Skeleton className="h-7 w-48" />
               <Skeleton className="h-9 w-32" />
            </div>
            <div className="grid gap-4 p-8 sm:grid-cols-2 xl:grid-cols-3">
               {Array.from({ length: CARDS }, (_, index) => (
                  <Skeleton key={index} className="h-28 w-full rounded-lg" />
               ))}
            </div>
         </main>
      </div>
   </div>
);

export default FullPageSkeleton;
