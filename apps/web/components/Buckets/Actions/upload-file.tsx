import { useBucketContext } from "@/components/Buckets/Context";
import { useGridContext } from "@/components/DataGrid/context";
import useSessionStore from "@/lib/stores/sessionStore";
import useUploadStore from "@/lib/stores/upload-store/uploadStore";
import { DropdownMenuItem } from "@s3-viewer/ui/components/dropdown-menu";
import { File, Loader2 } from "lucide-react";

const UploadFile = () => {
   const { bucket, path } = useBucketContext();
   const { gridRef, gridReady } = useGridContext();
   const serverId = useSessionStore((state) => state.serverId);
   const { isUploading, startUpload, setOnUploadComplete } = useUploadStore();

   const handleUpload = (files: File[]) => {
      if (!bucket?.Name || !serverId) {
         console.error("Missing bucket or server information");
         return;
      }

      const prefix = path.length > 0 ? path.join("/") + "/" : "";

      setOnUploadComplete(() => {
         if (gridReady && gridRef.current?.api) {
            gridRef.current.api.purgeInfiniteCache();
         }
      });

      startUpload({
         files: Array.from(files),
         bucketName: bucket.Name,
         serverId,
         prefix,
      });
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

   return (
      <DropdownMenuItem
         className="flex items-center gap-2 cursor-pointer size-full"
         onClick={handleUploadClick}
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
