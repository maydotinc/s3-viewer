import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import useServers from "@/lib/hooks/queries/server/useServers";
import { folderHref } from "@/lib/utils/s3/paths";
import { SITE_PATHS } from "@s3-viewer/types";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { cn } from "@s3-viewer/ui/lib/utils";
import { Folder } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";

const BucketList = () => {
   const router = useRouter();
   const { currentServer } = useServers();
   const { buckets, isBucketsLoading } = useBuckets();
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
               <Skeleton key={index} className="h-8 w-full rounded-md" />
            ))}
         </div>
      );
   }

   if (buckets.length === 0) {
      return (
         <p className="flex h-8 items-center px-2 text-sm text-viewerlighttext">
            No buckets yet
         </p>
      );
   }

   return (
      <nav aria-label="Buckets" className="min-h-0 overflow-y-auto">
         <ul className="flex flex-col gap-0.5">
            {buckets.map((bucket) => (
               <li key={bucket.name}>
                  <Link
                     href={folderHref(bucket.name, [])}
                     aria-current={
                        selected === bucket.name ? "page" : undefined
                     }
                     className={cn(
                        "flex h-8 items-center gap-2 rounded-md px-2 text-sm text-viewertext transition-colors hover:bg-viewergray",
                        selected === bucket.name &&
                           "bg-viewergray font-medium text-viewerblack"
                     )}
                  >
                     <Folder
                        aria-hidden="true"
                        className="size-4 shrink-0 text-viewertext"
                     />
                     <span className="min-w-0 truncate">{bucket.name}</span>
                  </Link>
               </li>
            ))}
         </ul>
      </nav>
   );
};

export default BucketList;
