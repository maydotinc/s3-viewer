import { authClient } from "@/lib/auth";
import { folderHref } from "@/lib/utils/s3/paths";
import { SITE_PATHS } from "@s3-viewer/types";
import {
   Breadcrumb,
   BreadcrumbEllipsis,
   BreadcrumbItem,
   BreadcrumbLink,
   BreadcrumbList,
   BreadcrumbPage,
   BreadcrumbSeparator,
} from "@s3-viewer/ui/components/breadcrumb";
import { Button } from "@s3-viewer/ui/components/button";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { House } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { useBucketContext } from "./Context";

const VISIBLE_TAIL = 3;

const shell =
   "flex h-14 w-full shrink-0 items-center gap-2 border-b border-viewerborder bg-viewerwhite px-6";

const BucketHeader = () => {
   const { data: session, isPending } = authClient.useSession();
   const { bucketName, path, isLoading } = useBucketContext();

   if (!session && !isPending) return null;

   if (isLoading || isPending) {
      return (
         <div className={shell} aria-busy="true">
            <Skeleton className="size-8 shrink-0" />
            <Skeleton className="h-4 w-48" />
         </div>
      );
   }

   const collapsed = path.length > VISIBLE_TAIL;
   const visible = collapsed ? path.slice(-VISIBLE_TAIL) : path;
   const offset = path.length - visible.length;

   return (
      <div className={shell}>
         <Breadcrumb className="flex min-w-0 flex-1 items-center">
            <BreadcrumbList className="min-w-0 flex-1 flex-nowrap gap-1.5 text-sm">
               <BreadcrumbItem className="shrink-0">
                  <Button
                     variant="ghost"
                     size="icon"
                     className="size-8"
                     asChild
                  >
                     <Link href={SITE_PATHS.dashboard} aria-label="All buckets">
                        <House className="size-4" aria-hidden="true" />
                     </Link>
                  </Button>
               </BreadcrumbItem>
               <BreadcrumbSeparator />
               <BreadcrumbItem>
                  {path.length > 0 ? (
                     <BreadcrumbLink asChild>
                        <Link
                           href={folderHref(bucketName, [])}
                           className="max-w-none truncate"
                        >
                           {bucketName}
                        </Link>
                     </BreadcrumbLink>
                  ) : (
                     <BreadcrumbPage className="min-w-0 max-w-none truncate font-semibold text-viewerblack">
                        {bucketName}
                     </BreadcrumbPage>
                  )}
               </BreadcrumbItem>
               {collapsed && (
                  <>
                     <BreadcrumbSeparator />
                     <BreadcrumbItem className="shrink-0">
                        <BreadcrumbEllipsis />
                     </BreadcrumbItem>
                  </>
               )}
               {visible.map((segment, index) => {
                  const depth = offset + index + 1;
                  const isLast = depth === path.length;
                  return (
                     <Fragment key={depth}>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                           {isLast ? (
                              <BreadcrumbPage className="min-w-0 truncate font-semibold text-viewerblack">
                                 {segment}
                              </BreadcrumbPage>
                           ) : (
                              <BreadcrumbLink asChild>
                                 <Link
                                    href={folderHref(
                                       bucketName,
                                       path.slice(0, depth)
                                    )}
                                    className="min-w-0 truncate"
                                 >
                                    {segment}
                                 </Link>
                              </BreadcrumbLink>
                           )}
                        </BreadcrumbItem>
                     </Fragment>
                  );
               })}
            </BreadcrumbList>
         </Breadcrumb>
      </div>
   );
};

export default BucketHeader;
