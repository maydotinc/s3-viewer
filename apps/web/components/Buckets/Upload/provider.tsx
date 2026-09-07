import { useBucketContext } from "@/components/Buckets/Context";
import { usePermission } from "@/lib/hooks/usePermission";
import { useStorageCapabilities } from "@/lib/hooks/useStorageCapabilities";
import { Permission } from "@s3-viewer/permissions";
import { isAborted } from "@/lib/api";
import { forgetKeys } from "@/lib/hooks/mutations/object/invalidate";
import useSessionStore, { useUserId } from "@/lib/stores/sessionStore";
import useUploadStore from "@/lib/stores/upload-store/uploadStore";
import type { UploadFile } from "@/lib/utils/s3/dropEntries";
import { checkUploadConflicts } from "@/lib/utils/s3/upload-preflight";
import { toastError } from "@/lib/utils/toast";
import { useQueryClient } from "@tanstack/react-query";
import {
   createContext,
   useCallback,
   useContext,
   useEffect,
   useMemo,
   useRef,
   useState,
} from "react";
import { ReplaceDialog } from "./replace-dialog";

type UploadTarget = {
   userId: string;
   serverId: string;
   bucketName: string;
   prefix: string;
};
type PendingReplace = UploadTarget & {
   files: UploadFile[];
   existing: string[];
   eTags: Record<string, string>;
};
type Preflight = { target: UploadTarget; controller: AbortController };

const sameTarget = (left: UploadTarget, right: UploadTarget): boolean =>
   left.userId === right.userId &&
   left.serverId === right.serverId &&
   left.bucketName === right.bucketName &&
   left.prefix === right.prefix;

type UploaderValue = {
   upload: (files: UploadFile[]) => Promise<void>;
   isChecking: boolean;
   canUpload: boolean;
   notice: string | null;
};

const UploaderContext = createContext<UploaderValue | null>(null);

const UploadProvider = ({ children }: { children: React.ReactNode }) => {
   const queryClient = useQueryClient();
   const userId = useUserId();
   const serverId = useSessionStore((state) => state.serverId);
   const { bucketName, prefix, refresh } = useBucketContext();
   const capabilities = useStorageCapabilities();
   const permitted = usePermission(Permission.UPLOAD_OBJECT, bucketName);
   const canUpload = permitted && capabilities.upload;
   const allowed = useRef(canUpload);
   allowed.current = canUpload;
   const canReplace = canUpload && capabilities.replace;
   const replacementAllowed = useRef(canReplace);
   replacementAllowed.current = canReplace;
   const enqueue = useUploadStore((state) => state.enqueue);
   const [pending, setPending] = useState<PendingReplace | null>(null);
   const [isChecking, setIsChecking] = useState(false);
   const mounted = useRef(true);
   const checking = useRef<Preflight | null>(null);
   const currentTarget = useRef<UploadTarget>({
      userId,
      serverId,
      bucketName,
      prefix,
   });
   currentTarget.current = { userId, serverId, bucketName, prefix };

   const isCurrent = useCallback((target: UploadTarget) => {
      const session = useSessionStore.getState();
      return (
         mounted.current &&
         sameTarget(target, currentTarget.current) &&
         session.userId === target.userId &&
         session.serverId === target.serverId
      );
   }, []);

   useEffect(() => {
      mounted.current = true;
      return () => {
         mounted.current = false;
      };
   }, []);

   useEffect(() => {
      const target = { userId, serverId, bucketName, prefix };
      setPending((previous) =>
         previous && sameTarget(previous, target) ? previous : null
      );
      setIsChecking(
         Boolean(
            checking.current && sameTarget(checking.current.target, target)
         )
      );
      return () => {
         if (checking.current && sameTarget(checking.current.target, target)) {
            checking.current.controller.abort();
            checking.current = null;
         }
      };
   }, [userId, serverId, bucketName, prefix]);

   const start = useCallback(
      (
         files: UploadFile[],
         target: UploadTarget,
         eTags: Record<string, string>
      ) => {
         if (!allowed.current || !isCurrent(target)) return;
         if (Object.keys(eTags).length > 0 && !replacementAllowed.current)
            return;
         const keys = files.map(
            (file) => `${target.prefix}${file.relativePath}`
         );
         enqueue({
            files,
            serverId: target.serverId,
            bucketName: target.bucketName,
            prefix: target.prefix,
            eTags,
            onComplete: () => {
               forgetKeys(
                  queryClient,
                  target.userId,
                  target.serverId,
                  target.bucketName,
                  keys
               );
               if (isCurrent(target)) refresh();
            },
         });
      },
      [enqueue, queryClient, isCurrent, refresh]
   );

   const upload = useCallback(
      async (files: UploadFile[]) => {
         if (files.length === 0 || !allowed.current) return;
         const target = { userId, serverId, bucketName, prefix };
         if (!userId || !serverId || !isCurrent(target)) return;
         checking.current?.controller.abort();
         const check = { target, controller: new AbortController() };
         checking.current = check;
         setPending(null);
         setIsChecking(true);
         try {
            const keys = files.map((file) => `${prefix}${file.relativePath}`);
            const result = await checkUploadConflicts({
               serverId,
               bucketName,
               keys,
               signal: check.controller.signal,
            });
            if (
               check.controller.signal.aborted ||
               checking.current !== check ||
               !isCurrent(target)
            )
               return;
            const found = new Set(result.existing);
            const existing = files
               .filter((file) => found.has(`${prefix}${file.relativePath}`))
               .map((file) => file.relativePath);
            if (existing.length > 0 && !replacementAllowed.current)
               throw new Error(
                  "Replacing existing files is unavailable for this provider. Upload them under new filenames."
               );
            if (existing.length > 0)
               setPending({ files, existing, eTags: result.eTags, ...target });
            else start(files, target, result.eTags);
         } catch (error) {
            if (
               !check.controller.signal.aborted &&
               checking.current === check &&
               isCurrent(target) &&
               !isAborted(error)
            )
               toastError("Couldn't start the upload")(error);
         } finally {
            if (checking.current === check) {
               checking.current = null;
               setIsChecking(false);
            }
         }
      },
      [userId, serverId, bucketName, prefix, isCurrent, start]
   );

   const value = useMemo(
      () => ({ upload, isChecking, canUpload, notice: capabilities.notice }),
      [upload, isChecking, canUpload, capabilities.notice]
   );

   const visiblePending =
      canReplace && pending && sameTarget(pending, currentTarget.current)
         ? pending
         : null;
   const replaceAll = () => {
      if (!visiblePending) return;
      start(visiblePending.files, visiblePending, visiblePending.eTags);
      setPending(null);
   };
   const skipExisting = () => {
      // the prompt only exists because replacement was on offer; a handler kept
      // from a render before that changed must not act on it either.
      if (!visiblePending || !replacementAllowed.current) return;
      const collisions = new Set(visiblePending.existing);
      const fresh = visiblePending.files.filter(
         (file) => !collisions.has(file.relativePath)
      );
      setPending(null);
      // no ETags: nothing is being replaced, so each upload stays conditional
      // on the key still being absent.
      if (fresh.length > 0) start(fresh, visiblePending, {});
   };

   return (
      <UploaderContext.Provider value={value}>
         {children}
         <ReplaceDialog
            open={visiblePending !== null}
            existing={visiblePending?.existing ?? []}
            total={visiblePending?.files.length ?? 0}
            onReplaceAll={replaceAll}
            onSkipExisting={skipExisting}
            onCancel={() => setPending(null)}
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
