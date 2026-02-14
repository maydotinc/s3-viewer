import { useModalContext } from "@/lib/contexts/ModalContext";
import useSessionStore from "@/lib/stores/sessionStore";
import getObjectUrl from "@/lib/utils/s3/getObjectUrl";
import getPresignedDownloadUrl from "@/lib/utils/s3/getPresignedDownloadUrl";
import { toast } from "@s3-viewer/ui/components/toast";
import { useRouter } from "next/router";
import { useCallback, useState } from "react";
import { useBucketContext } from "../Context";

const useObjectActions = () => {
   const router = useRouter();
   const [isLoading, setIsLoading] = useState(false);
   const { openConfirmDeleteModal } = useModalContext();
   const serverId = useSessionStore((state) => state.serverId);
   const { path, bucket } = useBucketContext();
   const objectKey = path.join("/");
   const objectName = objectKey.split("/").pop() || objectKey;

   const handleBack = useCallback(() => {
      const slug = router.query.slug;
      if (!Array.isArray(slug) || slug.length === 0) {
         router.push("/buckets");
         return;
      }
      const newSlug = slug.slice(0, -1);
      router.push({
         pathname: router.pathname,
         query: {
            slug: newSlug,
         },
      });
   }, [router]);

   const handleDownload = useCallback(async () => {
      setIsLoading(true);
      console.log("Downloading file", objectKey);
      if (!bucket?.Name || !serverId || !objectKey) {
         console.error(
            "Missing bucket name, server ID, file name, or file size"
         );
         setIsLoading(false);
         return;
      }
      try {
         const { url } = await getPresignedDownloadUrl(
            bucket?.Name,
            objectKey,
            serverId
         );
         if (!url) {
            console.error("No URL returned from presigned download URL");
            setIsLoading(false);
            return;
         }

         const a = document.createElement("a");
         a.href = url;
         a.download = objectName;
         a.style.display = "none";
         document.body.appendChild(a);
         a.click();
         document.body.removeChild(a);
      } catch (error) {
         console.error("Unable to download file", error);
      } finally {
         setIsLoading(false);
      }
   }, [bucket?.Name, serverId, objectKey, objectName]);

   const handleDelete = useCallback(async () => {
      if (!bucket?.Name || !serverId) {
         console.error(
            "Missing bucket name or server ID, cannot delete object"
         );
         return;
      }
      openConfirmDeleteModal({
         serverId,
         bucketName: bucket?.Name,
         fileNames: [objectKey],
         onDeleteSuccess: handleBack,
      });
   }, [bucket?.Name, serverId, objectKey, openConfirmDeleteModal, handleBack]);

   const handleCopyUrl = useCallback(async () => {
      if (!bucket?.Name || !serverId || !objectKey) {
         console.error("Missing bucket name, server ID, or object key");
         return;
      }
      try {
         setIsLoading(true);
         const { url, type } = await getObjectUrl(
            bucket.Name,
            objectKey,
            serverId
         );
         await navigator.clipboard.writeText(url);
         toast.success(
            type === "public"
               ? "Public URL copied to clipboard"
               : "Presigned URL copied to clipboard (expires in 1 hour)"
         );
      } catch (error) {
         console.error("Unable to get object URL", error);
         toast.error("Failed to copy URL");
      } finally {
         setIsLoading(false);
      }
   }, [bucket?.Name, serverId, objectKey]);

   return {
      objectKey,
      objectName,
      serverId,
      bucket,
      isLoading,
      handleBack,
      handleDownload,
      handleDelete,
      handleCopyUrl,
   };
};

export default useObjectActions;
