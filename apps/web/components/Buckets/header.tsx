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
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { House } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { useBucketContext } from "./Context";

const VISIBLE_TAIL = 3;
const MAX_SKELETON_CH = 24;

const shell =
   "flex min-h-[var(--header-height)] w-full items-center gap-2 border-b border-viewerborder px-8 py-4";

const BucketHeader = () => {
   const { data: session, isPending } = authClient.useSession();
   const { bucketName, path, isLoading } = useBucketContext();

   if (!session && !isPending) return null;

   if (isLoading || isPending) {
      const segments = [bucketName, ...path.slice(-VISIBLE_TAIL)];
      return (
         <div className={shell} aria-busy="true">
            <Skeleton className="size-5 shrink-0 rounded" />
            {segments.map((segment, index) => (
               <Fragment key={index}>
                  <span className="text-viewerborder">/</span>
                  <Skeleton
                     className="h-4 rounded"
                     style={{
                        width: `${Math.min(Math.max(segment.length, 4), MAX_SKELETON_CH)}ch`,
                     }}
                  />
               </Fragment>
            ))}
         </div>
      );
   }

   const collapsed = path.length > VISIBLE_TAIL;
   const visible = collapsed ? path.slice(-VISIBLE_TAIL) : path;
   const offset = path.length - visible.length;

   return (
      <div className={shell}>
         <Breadcrumb>
            <BreadcrumbList>
               <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                     <Link href={SITE_PATHS.dashboard} aria-label="All buckets">
                        <House className="size-5" aria-hidden="true" />
                     </Link>
                  </BreadcrumbLink>
               </BreadcrumbItem>
               <BreadcrumbSeparator />
               <BreadcrumbItem>
                  {path.length > 0 ? (
                     <BreadcrumbLink asChild>
                        <Link href={folderHref(bucketName, [])}>
                           {bucketName}
                        </Link>
                     </BreadcrumbLink>
                  ) : (
                     <BreadcrumbPage className="font-semibold text-viewerblack">
                        {bucketName}
                     </BreadcrumbPage>
                  )}
               </BreadcrumbItem>
               {collapsed && (
                  <>
                     <BreadcrumbSeparator />
                     <BreadcrumbItem>
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
                              <BreadcrumbPage className="max-w-64 truncate font-semibold text-viewerblack">
                                 {segment}
                              </BreadcrumbPage>
                           ) : (
                              <BreadcrumbLink asChild>
                                 <Link
                                    href={folderHref(
                                       bucketName,
                                       path.slice(0, depth)
                                    )}
                                    className="max-w-48 truncate"
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
