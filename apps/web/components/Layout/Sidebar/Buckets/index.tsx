import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import useServers from "@/lib/hooks/queries/server/useServers";
import { folderHref } from "@/lib/utils/s3/paths";
import { SITE_PATHS } from "@s3-viewer/types";
import { Spinner } from "@s3-viewer/ui/components/spinner";
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
         <div className="flex h-32 items-center justify-center">
            <Spinner label="Loading buckets" />
         </div>
      );
   }

   if (buckets.length === 0) {
      return (
         <p className="fade-in flex h-32 items-center justify-center text-sm text-viewerlighttext">
            No buckets yet
         </p>
      );
   }

   return (
      <nav
         aria-label="Buckets"
         className="fade-in min-h-0 overflow-y-auto px-2 pb-2"
      >
         <ul className="flex flex-col gap-1">
            {buckets.map((bucket) => (
               <li key={bucket.name}>
                  <Link
                     href={folderHref(bucket.name, [])}
                     aria-current={
                        selected === bucket.name ? "page" : undefined
                     }
                     className={cn(
                        "flex h-10 items-center gap-2 rounded-md p-2 text-sm text-viewertext hover:bg-viewergray hover:text-viewerblue",
                        selected === bucket.name &&
                           "bg-viewergray text-viewerblack"
                     )}
                  >
                     <Folder
                        aria-hidden="true"
                        className="size-4 shrink-0 text-viewerblue"
                     />
                     <span className="truncate">{bucket.name}</span>
                  </Link>
               </li>
            ))}
         </ul>
      </nav>
   );
};

export default BucketList;
