import {
   Breadcrumb,
   BreadcrumbItem,
   BreadcrumbLink,
   BreadcrumbList,
   BreadcrumbPage,
   BreadcrumbSeparator,
} from "@s3-viewer/ui/components/breadcrumb";
import { Button } from "@s3-viewer/ui/components/button";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { Folder, House, Link2 } from "lucide-react";
import Link from "next/link";
import { useBucketContext } from "./Context/context";

const BucketHeader = () => {
   const { bucket } = useBucketContext();

   if (!bucket) {
      return (
         <div className="flex flex-col w-full h-35 border-b border-viewerborder px-8 py-4 items-center justify-center">
            <Skeleton className="size-full" />
         </div>
      );
   }
   return (
      <div className="flex flex-col w-full h-35 border-b border-viewerborder px-8 py-4 justify-between">
         <Breadcrumb>
            <BreadcrumbList>
               <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                     <Link href="/home">
                        <House className="size-4" />
                     </Link>
                  </BreadcrumbLink>
               </BreadcrumbItem>
               <BreadcrumbSeparator />
               <BreadcrumbItem>
                  <BreadcrumbPage className="text-viewerblack font-semibold">
                     {bucket?.Name}
                  </BreadcrumbPage>
               </BreadcrumbItem>
            </BreadcrumbList>
         </Breadcrumb>
         <div className="flex w-full items-center">
            <div className="flex flex-1 items-center gap-2">
               <Folder className="size-6 text-viewerblue" />
               <span className="text-viewerblack font-semibold text-xl">
                  {bucket?.Name}
               </span>
            </div>
            <div className="flex flex-1 items-center justify-center gap-2">
               <div className="flex flex-col">
                  <span className="text-viewertext text-sm">Total Size</span>
                  <span className="text-viewerblack text-xl font-semibold">
                     {bucket?.TotalSize} TB
                  </span>
               </div>
            </div>
            <div className="flex flex-1 items-center gap-2 ml-auto">
               <Button>
                  <Link2 className="size-4" />
                  Custom Domain
               </Button>
               <Button>
                  <Link2 className="size-4" />
                  Public URL
               </Button>
            </div>
         </div>
      </div>
   );
};

export default BucketHeader;
