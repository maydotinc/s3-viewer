import { useModalActions } from "@/lib/contexts/ModalContext";
import { useEffectiveRole } from "@/lib/hooks/usePermission";
import useSessionStore from "@/lib/stores/sessionStore";
import { getDownloadUrl, saveFromUrl } from "@/lib/utils/s3/presign";
import { toastError } from "@/lib/utils/toast";
import { Permission, hasPermission } from "@s3-viewer/permissions";
import {
   PRESIGN_EXPIRY_SECONDS,
   baseName,
   type S3DeleteTarget,
} from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useCallback, useMemo } from "react";
import { useBucketContext } from "./Context";

type ObjectPermissions = {
   download: boolean;
   rename: boolean;
   delete: boolean;
};

type ObjectCommands = {
   can: ObjectPermissions;
   download: (objectKey: string) => Promise<void>;
   copyLink: (objectKey: string) => Promise<void>;
   rename: (
      objectKey: string,
      onSuccess?: (newObjectKey: string) => void
   ) => void;
   remove: (objects: S3DeleteTarget[], onSuccess?: () => void) => void;
};

const useObjectCommands = (bucketName: string): ObjectCommands => {
   const serverId = useSessionStore((state) => state.serverId);
   const { openRenameObjectModal, openConfirmDeleteModal } = useModalActions();
   const { refresh } = useBucketContext();

   const role = useEffectiveRole(bucketName);
   const canDownload = hasPermission(role, Permission.DOWNLOAD_OBJECT);
   const canDelete = hasPermission(role, Permission.DELETE_OBJECT);
   const canRename = canDelete;

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
      (objects: S3DeleteTarget[], onSuccess?: () => void) =>
         openConfirmDeleteModal({
            serverId,
            bucketName,
            objects,
            onDeleteSuccess: () => {
               refresh();
               onSuccess?.();
            },
         }),
      [openConfirmDeleteModal, serverId, bucketName, refresh]
   );

   return useMemo(
      () => ({
         can: { download: canDownload, rename: canRename, delete: canDelete },
         download,
         copyLink,
         rename,
         remove,
      }),
      [canDownload, canDelete, canRename, download, copyLink, rename, remove]
   );
};

export default useObjectCommands;
export type { ObjectCommands, ObjectPermissions };
