import type {
   BulkRenameSource,
   MoveSource,
   TransferSource,
} from "@/lib/contexts/modal-sources";
import { useModalActions } from "@/lib/contexts/modal-context";
import { useEffectiveRoleState } from "@/lib/hooks/usePermission";
import { useStorageCapabilities } from "@/lib/hooks/useStorageCapabilities";
import useArchiveDownload, {
   ARCHIVE_MUTATION_KEY,
} from "@/lib/hooks/mutations/object/useArchiveDownload";
import { useServerId } from "@/lib/stores/session-scope";
import { useUserId } from "@/lib/stores/session-store";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { downloadUrl } from "@/lib/utils/download";
import { getDownloadUrl } from "@/lib/utils/s3/presign";
import { toastError } from "@/lib/utils/toast";
import { Permission, hasPermission } from "@s3-viewer/permissions";
import {
   MAX_BATCH_KEYS,
   PRESIGN_EXPIRY_SECONDS,
   baseName,
   canPresignObjectKey,
   observedETagSchema,
   type S3DeleteTarget,
} from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useIsMutating } from "@tanstack/react-query";
import { createContext, useContext, useMemo } from "react";
import { useBucketContext } from "./Context";

type ObjectPermissions = {
   download: boolean;
   rename: boolean;
   upload: boolean;
   delete: boolean;
};

type ObjectCommands = {
   can: ObjectPermissions;
   isResolving: boolean;
   download: (objectKey: string) => Promise<void>;
   copyLink: (objectKey: string) => Promise<void>;
   rename: (
      objectKey: string,
      expectedETag: string | null,
      onSuccess?: (newObjectKey: string) => void
   ) => void;
   copy: (
      objectKey: string,
      expectedETag: string | null,
      onSuccess?: (newObjectKey: string) => void
   ) => void;
   createFolder: (
      prefix: string,
      onSuccess?: (folderKey: string) => void
   ) => void;
   moveMany: (
      source: MoveSource,
      onSuccess?: (destination: string) => void
   ) => void;
   transfer: (source: TransferSource, onSuccess?: () => void) => void;
   bulkRename: (source: BulkRenameSource, onSuccess?: () => void) => void;
   downloadZip: (objectKeys: string[]) => void;
   isPreparingZip: boolean;
   incompleteUploads: (prefix: string, onSuccess?: () => void) => void;
   editSettings: (
      objectKey: string,
      expectedETag: string | null,
      onSuccess?: () => void
   ) => void;
   remove: (objects: S3DeleteTarget[], onSuccess?: () => void) => void;
};

const COPY_LINK_FAILED = "Couldn't copy the link";

const guarded =
   <A extends unknown[]>(allowed: boolean, run: (...args: A) => void) =>
   (...args: A): void => {
      if (allowed) run(...args);
   };

const reviewed = (expectedETag: string | null, verb: string): string | null => {
   const parsed = observedETagSchema.safeParse(expectedETag);
   if (parsed.success) return parsed.data;
   toast.error(`Refresh and review the object before ${verb} it.`);
   return null;
};

const useCreateObjectCommands = (bucketName: string): ObjectCommands => {
   const userId = useUserId();
   const serverId = useServerId();
   const modals = useModalActions();
   const { reloadListing } = useBucketContext();
   const { mutate: archive } = useArchiveDownload();
   const isPreparingZip =
      useIsMutating({ mutationKey: ARCHIVE_MUTATION_KEY }) > 0;

   const { role, pending: isRolePending } = useEffectiveRoleState(bucketName);
   const capabilities = useStorageCapabilities();
   const isResolving = isRolePending || capabilities.pending;
   const canDownload = hasPermission(role, Permission.DOWNLOAD_OBJECT);
   const canDelete =
      capabilities.delete && hasPermission(role, Permission.DELETE_OBJECT);
   const canRename =
      capabilities.rename && hasPermission(role, Permission.DELETE_OBJECT);
   const canUpload =
      capabilities.upload && hasPermission(role, Permission.UPLOAD_OBJECT);

   return useMemo(() => {
      const scope = { serverId, bucketName };
      const settled =
         <A extends unknown[]>(onSuccess?: (...args: A) => void) =>
         (...args: A) => {
            reloadListing();
            onSuccess?.(...args);
         };
      const presign = (objectKey: string) =>
         getDownloadUrl(serverId, bucketName, objectKey);

      return {
         can: {
            download: canDownload,
            rename: canRename,
            upload: canUpload,
            delete: canDelete,
         },
         isResolving,
         isPreparingZip,
         download: async (objectKey) => {
            if (!canDownload) return;
            if (!canPresignObjectKey(objectKey)) {
               if (!isPreparingZip)
                  archive({ userId, ...scope, objectKeys: [objectKey] });
               return;
            }
            try {
               const { url } = await presign(objectKey);
               downloadUrl(url, baseName(objectKey));
            } catch (error) {
               toastError("Couldn't download the object")(error);
            }
         },
         copyLink: async (objectKey) => {
            if (!canDownload || !canPresignObjectKey(objectKey)) return;
            let url: string;
            try {
               ({ url } = await presign(objectKey));
            } catch (error) {
               toastError(COPY_LINK_FAILED)(error);
               return;
            }
            await copyToClipboard(url, {
               success: `Link copied. It expires in ${PRESIGN_EXPIRY_SECONDS / 60} minutes.`,
               failure: COPY_LINK_FAILED,
            });
         },
         rename: guarded(canRename, (objectKey, expectedETag, onSuccess) => {
            const eTag = reviewed(expectedETag, "renaming");
            if (eTag)
               modals.openScoped("renameObject", {
                  ...scope,
                  objectKey,
                  expectedETag: eTag,
                  onRenameSuccess: settled(onSuccess),
               });
         }),
         copy: guarded(canUpload, (objectKey, expectedETag, onSuccess) => {
            const eTag = reviewed(expectedETag, "copying");
            if (eTag)
               modals.openScoped("copyObject", {
                  ...scope,
                  objectKey,
                  expectedETag: eTag,
                  onCopySuccess: settled(onSuccess),
               });
         }),
         editSettings: guarded(
            canUpload,
            (objectKey, expectedETag, onSuccess) => {
               const eTag = reviewed(expectedETag, "changing");
               if (eTag)
                  modals.openScoped("objectSettings", {
                     ...scope,
                     objectKey,
                     expectedETag: eTag,
                     onSaved: settled(onSuccess),
                  });
            }
         ),
         createFolder: guarded(canUpload, (prefix, onSuccess) =>
            modals.openScoped("createFolder", {
               ...scope,
               prefix,
               onCreateSuccess: settled(onSuccess),
            })
         ),
         moveMany: guarded(canRename, (source, onSuccess) =>
            modals.openScoped("moveObjects", {
               ...scope,
               source,
               onMoved: reloadListing,
               onMoveComplete: onSuccess,
            })
         ),
         transfer: guarded(canDownload, (source, onSuccess) =>
            modals.openScoped("transferObjects", {
               ...scope,
               source,
               onTransferred: settled(onSuccess),
            })
         ),
         bulkRename: guarded(canRename && canUpload, (source, onSuccess) =>
            modals.openScoped("bulkRename", {
               ...scope,
               source,
               onRenamed: settled(onSuccess),
            })
         ),
         incompleteUploads: guarded(canDelete, (prefix, onSuccess) =>
            modals.openScoped("incompleteUploads", {
               ...scope,
               prefix,
               onAborted: settled(onSuccess),
            })
         ),
         remove: guarded(canDelete, (objects, onSuccess) =>
            modals.openScoped("confirmDelete", {
               ...scope,
               objects,
               onDeleteSuccess: settled(onSuccess),
            })
         ),
         downloadZip: guarded(canDownload, (objectKeys) => {
            if (objectKeys.length === 0 || isPreparingZip) return;
            if (objectKeys.length > MAX_BATCH_KEYS) {
               toast.error(`Select up to ${MAX_BATCH_KEYS} items for one zip`);
               return;
            }
            archive({ userId, ...scope, objectKeys });
         }),
      };
   }, [
      userId,
      serverId,
      bucketName,
      modals,
      reloadListing,
      archive,
      isPreparingZip,
      isResolving,
      canDownload,
      canRename,
      canUpload,
      canDelete,
   ]);
};

// one instance per page: each call subscribes to servers, buckets, capabilities and mutations
const ObjectCommandsContext = createContext<ObjectCommands | null>(null);

const ObjectCommandsProvider = ObjectCommandsContext.Provider;

const useObjectCommands = (): ObjectCommands => {
   const commands = useContext(ObjectCommandsContext);
   if (!commands)
      throw new Error(
         "useObjectCommands must be used within an ObjectCommandsProvider"
      );
   return commands;
};

export default useObjectCommands;
export { ObjectCommandsProvider, useCreateObjectCommands };
export type { ObjectCommands };
