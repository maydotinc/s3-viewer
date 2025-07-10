import { useBucketContext } from "@/components/Buckets/Context";
import { useGridContext } from "@/components/DataGrid/context";
import useUploadFiles from "@/lib/hooks/mutations/object/useUploadFiles";
import useSessionStore from "@/lib/stores/sessionStore";
import { DropdownMenuItem } from "@s3-viewer/ui/components/dropdown-menu";
import { File, Loader2 } from "lucide-react";
import { useState } from "react";

interface UploadProgress {
   [fileIndex: number]: {
      fileName: string;
      progress: number;
      completed: boolean;
   };
}

const UploadFile = () => {
   const { bucket, path } = useBucketContext();
   const { gridRef, gridReady } = useGridContext();
   const serverId = useSessionStore((state) => state.serverId);
   const [uploadProgress, setUploadProgress] = useState<UploadProgress>({});
   const uploadFilesMutation = useUploadFiles();

   const handleUpload = (files: File[]) => {
      if (!bucket?.Name || !serverId) {
         console.error("Missing bucket or server information");
         return;
      }

      setUploadProgress({});
      const prefix = path.length > 0 ? path.join("/") + "/" : "";

      uploadFilesMutation.mutate(
         {
            files: Array.from(files),
            bucketName: bucket.Name,
            serverId,
            prefix,
            onProgress: (fileIndex, progress, fileName) => {
               setUploadProgress((prev) => ({
                  ...prev,
                  [fileIndex]: {
                     fileName,
                     progress,
                     completed: false,
                  },
               }));
            },
            onFileComplete: (fileIndex, fileName) => {
               setUploadProgress((prev) => ({
                  ...prev,
                  [fileIndex]: {
                     fileName,
                     progress: 100,
                     completed: true,
                  },
               }));
            },
         },
         {
            onSuccess: () => {
               console.log("🔵 Upload successful");
               if (gridReady && gridRef.current?.api) {
                  gridRef.current.api.purgeInfiniteCache();
               }
            },
         }
      );
   };

   const handleUploadClick = () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "*/*";
      input.multiple = true;

      input.onchange = (e) => {
         const files = (e.target as HTMLInputElement).files;
         if (files && files.length > 0) {
            handleUpload(Array.from(files));
         }
      };

      input.click();
   };

   const isUploading = uploadFilesMutation.isPending;

   return (
      <DropdownMenuItem
         className="flex items-center gap-2 cursor-pointer size-full"
         onSelect={(e) => {
            e.preventDefault(); // COME BACK HERE AND FIX THIS W REFATOR
            handleUploadClick();
         }}
         disabled={isUploading || !bucket?.Name || !serverId}
      >
         {isUploading ? (
            <Loader2 className="size-4 animate-spin text-inherit" />
         ) : (
            <File className="size-4 text-inherit" />
         )}

         <div className="flex flex-col flex-1">
            <span>Upload Files</span>
         </div>
      </DropdownMenuItem>
   );
};

export default UploadFile;
