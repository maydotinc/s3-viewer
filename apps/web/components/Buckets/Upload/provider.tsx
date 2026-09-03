import { useBucketContext } from "@/components/Buckets/Context";
import { ConfirmDialog } from "@/components/Modals/confirm-dialog";
import { forgetObjects } from "@/lib/hooks/mutations/object/invalidate";
import useSessionStore, { useUserId } from "@/lib/stores/sessionStore";
import useUploadStore from "@/lib/stores/upload-store/uploadStore";
import type { UploadFile } from "@/lib/utils/s3/dropEntries";
import { headObject } from "@/lib/utils/s3/presign";
import { toastError } from "@/lib/utils/toast";
import { mapLimit } from "@s3-viewer/types";
import { useQueryClient } from "@tanstack/react-query";
import {
   createContext,
   useCallback,
   useContext,
   useMemo,
   useState,
} from "react";

const HEAD_CONCURRENCY = 6;

type PendingReplace = {
   files: UploadFile[];
   existing: string[];
   bucketName: string;
   prefix: string;
};

type UploaderValue = {
   upload: (files: UploadFile[]) => Promise<void>;
   isChecking: boolean;
};

const UploaderContext = createContext<UploaderValue | null>(null);

const UploadProvider = ({ children }: { children: React.ReactNode }) => {
   const queryClient = useQueryClient();
   const userId = useUserId();
   const serverId = useSessionStore((state) => state.serverId);
   const { bucketName, prefix, refresh } = useBucketContext();
   const enqueue = useUploadStore((state) => state.enqueue);
   const [pending, setPending] = useState<PendingReplace | null>(null);
   const [isChecking, setIsChecking] = useState(false);

   const start = useCallback(
      (files: UploadFile[], target: { bucketName: string; prefix: string }) => {
         const keys = files.map(
            (file) => `${target.prefix}${file.relativePath}`
         );
         enqueue({
            files,
            serverId,
            ...target,
            onComplete: () => {
               forgetObjects(
                  queryClient,
                  userId,
                  serverId,
                  target.bucketName,
                  keys
               );
               refresh();
            },
         });
      },
      [enqueue, queryClient, userId, serverId, refresh]
   );

   const upload = useCallback(
      async (files: UploadFile[]) => {
         if (files.length === 0) return;
         const target = { bucketName, prefix };
         setIsChecking(true);
         try {
            const checks = await mapLimit(
               files,
               HEAD_CONCURRENCY,
               async (entry) =>
                  (await headObject(
                     serverId,
                     bucketName,
                     `${prefix}${entry.relativePath}`
                  ))
                     ? entry.relativePath
                     : null
            );
            const existing = checks.filter(
               (path): path is string => path !== null
            );
            if (existing.length > 0) setPending({ files, existing, ...target });
            else start(files, target);
         } catch (error) {
            toastError("Couldn't start the upload")(error);
         } finally {
            setIsChecking(false);
         }
      },
      [serverId, bucketName, prefix, start]
   );

   const value = useMemo(() => ({ upload, isChecking }), [upload, isChecking]);

   const confirmReplace = () => {
      if (!pending) return;
      start(pending.files, {
         bucketName: pending.bucketName,
         prefix: pending.prefix,
      });
      setPending(null);
   };

   const names = pending?.existing.slice(0, 3).join(", ") ?? "";
   const more =
      pending && pending.existing.length > 3
         ? ` and ${pending.existing.length - 3} more`
         : "";

   return (
      <UploaderContext.Provider value={value}>
         {children}
         <ConfirmDialog
            open={pending !== null}
            onClose={() => setPending(null)}
            title={
               pending?.existing.length === 1
                  ? "Replace existing file?"
                  : "Replace existing files?"
            }
            description={
               pending?.existing.length === 1
                  ? `${names} already exists in this folder and will be overwritten.`
                  : `${pending?.existing.length ?? 0} of the selected files already exist in this folder and will be overwritten: ${names}${more}.`
            }
            descriptionClassName="break-all"
            confirmLabel="Replace"
            onConfirm={confirmReplace}
         />
      </UploaderContext.Provider>
   );
};

const useUploader = () => {
   const context = useContext(UploaderContext);
   if (!context)
      throw new Error("useUploader must be used within an UploadProvider");
   return context;
};

export { UploadProvider, useUploader };
