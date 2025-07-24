import {
   Breadcrumb,
   BreadcrumbEllipsis,
   BreadcrumbItem,
   BreadcrumbLink,
   BreadcrumbList,
   BreadcrumbPage,
   BreadcrumbSeparator,
} from "@s3-viewer/ui/components/breadcrumb";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { House } from "lucide-react";
import Link from "next/link";
import { useBucketContext } from "./Context";

const BucketHeader = () => {
   const { bucket, path } = useBucketContext();

   const shouldCollapse = path.length > 3;
   const visiblePath = shouldCollapse ? path.slice(-3) : path;
   const hiddenSegments = shouldCollapse ? path.length - 3 : 0;

   if (!bucket) {
      return (
         <div className="flex flex-col w-full h-35 border-b border-viewerborder px-8 py-4 items-center justify-center">
            <Skeleton className="size-full" />
         </div>
      );
   }

   return (
      <div className="flex min-h-[var(--header-height)] box-border w-full border-b border-viewerborder px-8 py-4 gap-2 max-lg:gap-4 items-center">
         <Breadcrumb>
            <BreadcrumbList>
               <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                     <Link href="/home">
                        <House className="size-5" />
                     </Link>
                  </BreadcrumbLink>
               </BreadcrumbItem>
               <BreadcrumbSeparator />
               <BreadcrumbItem>
                  {path.length > 0 ? (
                     <BreadcrumbLink asChild>
                        <Link href={`/buckets/${bucket?.Name}`}>
                           {bucket?.Name}
                        </Link>
                     </BreadcrumbLink>
                  ) : (
                     <BreadcrumbPage className="text-viewerblack font-semibold">
                        {bucket?.Name}
                     </BreadcrumbPage>
                  )}
               </BreadcrumbItem>
               {shouldCollapse && (
                  <>
                     <BreadcrumbSeparator />
                     <BreadcrumbItem>
                        <BreadcrumbEllipsis />
                     </BreadcrumbItem>
                  </>
               )}
               {visiblePath.map((item, index) => {
                  const isLast = index === visiblePath.length - 1;
                  const actualIndex = shouldCollapse
                     ? hiddenSegments + index
                     : index;

                  return (
                     <div key={`${actualIndex}-${item}`} className="contents">
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                           {isLast ? (
                              <BreadcrumbPage className="text-viewerblack font-semibold">
                                 {item}
                              </BreadcrumbPage>
                           ) : (
                              <BreadcrumbLink asChild>
                                 <Link
                                    href={`/buckets/${bucket?.Name}/${path
                                       .slice(0, actualIndex + 1)
                                       .join("/")}`}
                                 >
                                    {item}
                                 </Link>
                              </BreadcrumbLink>
                           )}
                        </BreadcrumbItem>
                     </div>
                  );
               })}
            </BreadcrumbList>
         </Breadcrumb>
      </div>
   );
};

export default BucketHeader;
