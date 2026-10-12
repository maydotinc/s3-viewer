import { useBucketContext } from "@/components/Buckets/Context";
import { usePermission } from "@/lib/hooks/usePermission";
import { useStorageCapabilities } from "@/lib/hooks/useStorageCapabilities";
import { Permission } from "@s3-viewer/permissions";
import { isAborted } from "@/lib/api";
import { forgetKeys } from "@/lib/hooks/mutations/object/invalidate";
import type { BucketTarget } from "@/lib/types";
import { useAbortableTask } from "@/lib/hooks/useAbortableTask";
import { useServerId } from "@/lib/stores/session-scope";
import useSessionStore, { useUserId } from "@/lib/stores/session-store";
import useUploadStore from "@/lib/stores/upload-store/upload-store";
import { MAX_UPLOAD_FILES, type UploadFile } from "@/lib/utils/s3/drop-entries";
import { checkUploadConflicts } from "@/lib/utils/s3/upload-preflight";
import { writeBlockReason } from "@/lib/utils/folder-access";
import { formatCount } from "@/lib/utils/format";
import { toastError } from "@/lib/utils/toast";
import { MAX_BATCH_KEYS, chunk, fileKeySchema } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
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

type UploadTarget = BucketTarget & { prefix: string };
type PendingReplace = UploadTarget & {
   files: UploadFile[];
   existing: string[];
   eTags: Record<string, string>;
   dropFileCount: number;
};
type Preflight = { target: UploadTarget; controller: AbortController };

const PREFLIGHT_CHUNK_FILES = MAX_BATCH_KEYS;
const PREFLIGHT_TIMEOUT_MS = 75_000;
const PREFLIGHT_TIMED_OUT =
   "Checking for existing files took too long. Try the upload again.";
const STILL_CHECKING =
   "Still checking the last upload. Add these files again once it starts.";

const sameTarget = (left: UploadTarget, right: UploadTarget): boolean =>
   left.userId === right.userId &&
   left.serverId === right.serverId &&
   left.bucketName === right.bucketName &&
   left.prefix === right.prefix;

type UploaderValue = {
   upload: (files: UploadFile[]) => Promise<void>;
   isChecking: boolean;
   canUpload: boolean;
   blockedReason: string | null;
   notice: string | null;
};

const UploaderContext = createContext<UploaderValue | null>(null);

const UploadProvider = ({ children }: { children: React.ReactNode }) => {
   const queryClient = useQueryClient();
   const userId = useUserId();
   const serverId = useServerId();
   const { bucketName, prefix, reach, reloadListing } = useBucketContext();
   const capabilities = useStorageCapabilities();
   const permitted = usePermission(Permission.UPLOAD_OBJECT, bucketName);
   const outsideFolders = writeBlockReason(reach, prefix);
   const blockedReason =
      permitted && capabilities.upload ? outsideFolders : null;
   const canUpload = permitted && capabilities.upload && !outsideFolders;
   const allowed = useRef(canUpload);
   allowed.current = canUpload;
   const canReplace = canUpload && capabilities.replace;
   const replacementAllowed = useRef(canReplace);
   replacementAllowed.current = canReplace;
   const enqueue = useUploadStore((state) => state.enqueue);
   const [pending, setPending] = useState<PendingReplace | null>(null);
   const [isChecking, setIsChecking] = useState(false);
   const task = useAbortableTask();
   const currentRefresh = useRef(reloadListing);
   currentRefresh.current = reloadListing;
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
         sameTarget(target, currentTarget.current) &&
         session.userId === target.userId &&
         session.serverId === target.serverId
      );
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
         enqueue({
            files,
            serverId: target.serverId,
            bucketName: target.bucketName,
            prefix: target.prefix,
            eTags,
            onSettled: (keys) => {
               forgetKeys(
                  queryClient,
                  target.userId,
                  target.serverId,
                  target.bucketName,
                  keys
               );
               task.ifMounted(() => {
                  const current = currentTarget.current;
                  if (
                     isCurrent(current) &&
                     target.userId === current.userId &&
                     target.serverId === current.serverId &&
                     target.bucketName === current.bucketName &&
                     keys.some((key) => key.startsWith(current.prefix))
                  )
                     currentRefresh.current();
               });
            },
         });
      },
      [enqueue, queryClient, isCurrent, task]
   );

   const upload = useCallback(
      async (files: UploadFile[]) => {
         if (files.length === 0 || !allowed.current) return;
         if (files.length > MAX_UPLOAD_FILES) {
            toast.error(
               `Upload up to ${formatCount(MAX_UPLOAD_FILES)} files at a time.`
            );
            return;
         }
         const invalid = files.find(
            ({ relativePath }) =>
               !fileKeySchema.safeParse(`${prefix}${relativePath}`).success
         );
         if (invalid) {
            toast.error(
               `Invalid upload key: ${prefix}${invalid.relativePath}. Use a valid file key of at most 1,024 UTF-8 bytes.`
            );
            return;
         }
         const target = { userId, serverId, bucketName, prefix };
         if (!userId || !serverId || !isCurrent(target)) return;
         if (checking.current) {
            toast.error(STILL_CHECKING);
            return;
         }
         const check = { target, controller: new AbortController() };
         checking.current = check;
         setPending(null);
         setIsChecking(true);
         const stale = () =>
            check.controller.signal.aborted ||
            checking.current !== check ||
            !isCurrent(target);
         const held: PendingReplace = {
            ...target,
            files: [],
            existing: [],
            eTags: {},
            dropFileCount: files.length,
         };
         const attempt = new AbortController();
         const cancel = () => attempt.abort();
         let timedOut = false;
         let timer: ReturnType<typeof setTimeout> | undefined;
         check.controller.signal.addEventListener("abort", cancel);
         try {
            for (const slice of chunk(files, PREFLIGHT_CHUNK_FILES)) {
               clearTimeout(timer);
               timer = setTimeout(() => {
                  timedOut = true;
                  cancel();
               }, PREFLIGHT_TIMEOUT_MS);
               const result = await checkUploadConflicts({
                  serverId,
                  bucketName,
                  keys: slice.map((file) => `${prefix}${file.relativePath}`),
                  signal: attempt.signal,
               });
               if (stale()) return;
               const found = new Set(result.existing);
               const existing = slice
                  .filter((file) => found.has(`${prefix}${file.relativePath}`))
                  .map((file) => file.relativePath);
               if (existing.length === 0) {
                  start(slice, target, result.eTags);
                  continue;
               }
               if (!replacementAllowed.current)
                  throw new Error(
                     "Storage capabilities are unavailable right now. Refresh and try the upload again."
                  );
               held.files.push(...slice);
               held.existing.push(...existing);
               Object.assign(held.eTags, result.eTags);
            }
            if (held.files.length > 0) setPending(held);
         } catch (error) {
            if (stale()) return;
            if (timedOut) toast.error(PREFLIGHT_TIMED_OUT);
            else if (!isAborted(error))
               toastError("Couldn't start the upload")(error);
         } finally {
            clearTimeout(timer);
            check.controller.signal.removeEventListener("abort", cancel);
            if (checking.current === check) {
               checking.current = null;
               setIsChecking(false);
            }
         }
      },
      [userId, serverId, bucketName, prefix, isCurrent, start]
   );

   const value = useMemo(
      () => ({
         upload,
         isChecking,
         canUpload,
         blockedReason,
         notice: capabilities.notice,
      }),
      [upload, isChecking, canUpload, blockedReason, capabilities.notice]
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
      if (!visiblePending || !replacementAllowed.current) return;
      const collisions = new Set(visiblePending.existing);
      const fresh = visiblePending.files.filter(
         (file) => !collisions.has(file.relativePath)
      );
      setPending(null);
      if (fresh.length > 0) start(fresh, visiblePending, {});
   };

   return (
      <UploaderContext.Provider value={value}>
         {children}
         <ReplaceDialog
            open={visiblePending !== null}
            existing={visiblePending?.existing ?? []}
            pendingFileCount={visiblePending?.files.length ?? 0}
            dropFileCount={visiblePending?.dropFileCount ?? 0}
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

export { STILL_CHECKING, UploadProvider, useUploader };
