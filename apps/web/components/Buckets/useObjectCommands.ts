import { useModalContext } from "@/lib/contexts/ModalContext";
import { usePermission } from "@/lib/hooks/usePermission";
import useSessionStore from "@/lib/stores/sessionStore";
import { getDownloadUrl, saveFromUrl } from "@/lib/utils/s3/presign";
import { toastError } from "@/lib/utils/toast";
import { Permission } from "@s3-viewer/permissions";
import { PRESIGN_EXPIRY_SECONDS, baseName } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useCallback, useMemo } from "react";
import { useBucketContext } from "./Context";

const useObjectCommands = (bucketName: string) => {
   const serverId = useSessionStore((state) => state.serverId);
   const { openRenameObjectModal, openConfirmDeleteModal } = useModalContext();
   const { refresh } = useBucketContext();

   const canDownload = usePermission(Permission.DOWNLOAD_OBJECT, bucketName);
   const canDelete = usePermission(Permission.DELETE_OBJECT, bucketName);

   const download = useCallback(
      async (objectKey: string) => {
         try {
            const { url } = await getDownloadUrl(
               serverId,
               bucketName,
               objectKey
            );
            saveFromUrl(url, baseName(objectKey));
         } catch (error) {
            toastError("Couldn't download the object")(error);
         }
      },
      [serverId, bucketName]
   );

   const copyLink = useCallback(
      async (objectKey: string) => {
         try {
            const { url } = await getDownloadUrl(
               serverId,
               bucketName,
               objectKey
            );
            await navigator.clipboard.writeText(url);
            toast.success(
               `Link copied. It expires in ${PRESIGN_EXPIRY_SECONDS / 60} minutes.`
            );
         } catch (error) {
            toastError("Couldn't copy the link")(error);
         }
      },
      [serverId, bucketName]
   );

   const rename = useCallback(
      (objectKey: string, onSuccess?: (newObjectKey: string) => void) =>
         openRenameObjectModal({
            serverId,
            bucketName,
            objectKey,
            onRenameSuccess: (newObjectKey) => {
               refresh();
               onSuccess?.(newObjectKey);
            },
         }),
      [openRenameObjectModal, serverId, bucketName, refresh]
   );

   const remove = useCallback(
      (objectKeys: string[], onSuccess?: () => void) =>
         openConfirmDeleteModal({
            serverId,
            bucketName,
            objectKeys,
            onDeleteSuccess: () => {
               refresh();
               onSuccess?.();
            },
         }),
      [openConfirmDeleteModal, serverId, bucketName, refresh]
   );

   return useMemo(
      () => ({
         can: { download: canDownload, rename: canDelete, delete: canDelete },
         download,
         copyLink,
         rename,
         remove,
      }),
      [canDownload, canDelete, download, copyLink, rename, remove]
   );
};

export default useObjectCommands;
