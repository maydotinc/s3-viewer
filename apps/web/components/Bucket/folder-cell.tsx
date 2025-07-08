import { ICellRendererParams } from "ag-grid-community";
import { Loader2 } from "lucide-react";
import Link from "next/link";

const FolderCell = (params: ICellRendererParams) => {
   if (params.value === undefined) {
      return (
         <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin" />
         </div>
      );
   }

   const bucketName = params.context?.bucketName;
   const path = params.context?.path.join("/");
   const normalizedValue =
      path.length === 0 ? params.value : params.value.slice(path.length + 1);

   if (params.value.endsWith("/")) {
      return (
         <Link
            href={`/buckets/${bucketName}/${path}/${normalizedValue}`}
            className="text-viewerblue underline"
         >
            {normalizedValue}
         </Link>
      );
   }

   return <span className="text-viewertext">{normalizedValue}</span>;
};

export default FolderCell;
