import { ICellRendererParams } from "ag-grid-community";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";

const FolderCell = (params: ICellRendererParams) => {
   const router = useRouter();

   if (params.value === undefined) {
      return (
         <div className="flex items-center h-full">
            <Loader2 className="animate-spin" />
         </div>
      );
   }

   const bucketName = params.context?.bucketName;
   const path = params.context?.path.join("/");
   const normalizedValue =
      path.length === 0 ? params.value : params.value.slice(path.length + 1);

   if (params.value.endsWith("/")) {
      const slugSegments = [
         bucketName,
         ...(params.context?.path || []),
         normalizedValue.slice(0, -1),
      ];

      const href = {
         pathname: "/buckets/[[...slug]]",
         query: { slug: slugSegments },
      };

      return (
         <Link href={href} className="text-viewerblue underline">
            {normalizedValue}
         </Link>
      );
   }

   return (
      <span
         className="text-viewertext hover:cursor-pointer hover:text-viewerblack"
         onClick={() => {
            router.push({
               pathname: "/buckets/[[...slug]]",
               query: {
                  slug: [
                     bucketName,
                     ...(params.context?.path || []),
                     normalizedValue,
                  ],
                  view: "object",
               },
            });
         }}
      >
         {normalizedValue}
      </span>
   );
};

export default FolderCell;
