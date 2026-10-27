import type { BucketTarget } from "@/lib/types";
import { yieldToEventLoop } from "@/lib/utils/yield-to-event-loop";
import { isFolderRefusal } from "@/lib/utils/folder-refusal";
import { pluralize } from "@/lib/utils/format";
import { chunk, DEFAULT_CONTENT_TYPE } from "@s3-viewer/shared";
import { toast } from "@s3-viewer/ui/components/toast";
import { create } from "zustand";
import type { UploadFile } from "@/lib/utils/s3/drop-entries";
import { isCancelled } from "@/lib/utils/s3/upload-cancelled";
import { uploadObject } from "@/lib/utils/s3/upload-object";
import useSessionStore from "@/lib/stores/session-store";
import { entryId, isOpen, openUploadKeys } from "./entries";
import { registerUploadReset, uploadsSuspended } from "./lifecycle";
import type { UploadBatch, UploadEntry } from "./types";

const FILE_CONCURRENCY = 3;
const MIN_PROGRESS_STEP = 64 * 1024;
const PROGRESS_STEPS = 100;
const ENQUEUE_CHUNK_SIZE = 200;
const COMPLETED_HISTORY_LIMIT = 1000;
const QUEUE_COMPACT_AT = 1024;

type Job = BucketTarget & {
   file: File;
   objectKey: string;
   contentType: string;
   expectedETag?: string;
   abort: (() => void) | null;
};

const jobs = new Map<string, Job>();
const workers = new Set<Promise<void>>();

type Settlement = (keys: string[]) => void;
type ScopeBatch = {
   callback: Settlement;
   keys: Map<string, string>;
   open: Set<string>;
   enqueuing: number;
};
const batchCallbacks = new Map<string, ScopeBatch>();
let enqueueGeneration = 0;
let activeEnqueues = 0;

const batchScope = (userId: string, serverId: string, bucketName: string) =>
   JSON.stringify([userId, serverId, bucketName]);
const scopeOf = (job: Job) =>
   batchScope(job.userId, job.serverId, job.bucketName);

const settleScope = ({ callback, keys }: ScopeBatch) => {
   if (keys.size) callback([...keys.values()]);
};

const flushBatchCallbacks = () => {
   const batches = [...batchCallbacks.values()];
   batchCallbacks.clear();
   for (const batch of batches) settleScope(batch);
};

// a bucket's listing reloads once its own uploads finish, not when every bucket's have
const flushScopeIfIdle = (scope: string) => {
   const batch = batchCallbacks.get(scope);
   if (!batch || batch.open.size > 0 || batch.enqueuing > 0) return;
   batchCallbacks.delete(scope);
   settleScope(batch);
};

const adjustBatchCounts = (
   batch: UploadBatch,
   status: UploadEntry["status"],
   by: 1 | -1
) => {
   if (status === "completed") batch.completed += by;
   else if (status === "failed") batch.failed += by;
};

type UploadState = {
   entries: Record<string, UploadEntry>;
   progress: Record<string, number>;
   order: string[];
   batch: UploadBatch | null;
   isUploading: boolean;
   // bumped whenever an entry's status changes, since in-place patching keeps entries' identity
   statusVersion: number;
};

type UploadActions = {
   enqueue: (params: {
      files: UploadFile[];
      serverId: string;
      bucketName: string;
      prefix: string;
      eTags?: Record<string, string>;
      onSettled?: Settlement;
   }) => void;
   cancel: (id: string) => void;
   cancelAll: () => void;
   cancelAllAndClear: () => Promise<void>;
};

type UploadStore = UploadState & UploadActions;

// pending ids live past queueHead so dequeuing a 10k drop is not O(n) per slot
let queue: string[] = [];
let queueHead = 0;

const queued = () => queue.length - queueHead;

const dequeue = (count: number) => {
   const next = queue.slice(queueHead, queueHead + count);
   queueHead += next.length;
   if (queueHead >= QUEUE_COMPACT_AT && queueHead * 2 >= queue.length) {
      queue = queue.slice(queueHead);
      queueHead = 0;
   }
   return next;
};

const bumpStatus = ({ statusVersion }: UploadState) => ({
   statusVersion: statusVersion + 1,
});

// entries and progress are patched in place with a new object for the changed row only:
// copying the whole record per update cost over a minute of main-thread time on a 10k drop
const useUploadStore = create<UploadStore>()((set, get) => {
   const setEntry = (id: string, patch: Partial<UploadEntry>) => {
      const { entries, progress, batch } = get();
      const entry = entries[id];
      if (!entry) return;
      const settles = patch.status && patch.status !== "active";
      entries[id] = {
         ...entry,
         ...(settles && { uploadedBytes: progress[id] ?? entry.uploadedBytes }),
         ...patch,
      };
      if (settles) delete progress[id];
      if (!patch.status) set({});
      else if (!batch) set(bumpStatus);
      else {
         const next = { ...batch };
         adjustBatchCounts(next, entry.status, -1);
         adjustBatchCounts(next, patch.status, 1);
         set((state) => ({ ...bumpStatus(state), batch: next }));
      }
   };

   const settleBatchIfDone = () => {
      const { batch } = get();
      if (
         !batch ||
         batch.settled ||
         jobs.size > 0 ||
         queued() > 0 ||
         activeEnqueues > 0
      )
         return;

      set({ batch: { ...batch, settled: true }, isUploading: false });

      const { completed, failed, refusal } = batch;
      const total = batch.ids.length;
      if (failed > 0) {
         const title = `${completed} of ${pluralize(total, "file")} uploaded. ${failed} failed.`;
         if (refusal) toast.error(title, { description: refusal });
         else toast.error(title);
      } else if (completed > 0) {
         toast.success(
            completed === 1
               ? "File uploaded."
               : `${pluralize(completed, "file")} uploaded.`
         );
      }
      flushBatchCallbacks();
      const { entries, order } = get();
      const finished = order.filter(
         (id) => entries[id]?.status === "completed"
      );
      if (finished.length > COMPLETED_HISTORY_LIMIT) {
         const expired = new Set(finished.slice(0, -COMPLETED_HISTORY_LIMIT));
         for (const id of expired) delete entries[id];
         set({ order: order.filter((id) => !expired.has(id)) });
      }
   };

   const runJob = async (id: string) => {
      const job = jobs.get(id);
      if (!job) return;
      if (useSessionStore.getState().userId !== job.userId) {
         get().cancelAllAndClear();
         return;
      }
      const owns = () => jobs.get(id) === job;
      const step = Math.min(
         job.file.size,
         Math.max(MIN_PROGRESS_STEP, Math.ceil(job.file.size / PROGRESS_STEPS))
      );
      let reported = 0;
      const onProgress = (loaded: number) => {
         if (
            !owns() ||
            get().entries[id]?.status !== "active" ||
            (loaded >= reported && loaded - reported < step)
         )
            return;
         reported = loaded;
         get().progress[id] = Math.min(loaded, job.file.size);
         set({});
      };

      const scope = scopeOf(job);
      try {
         batchCallbacks.get(scope)?.keys.set(id, job.objectKey);
         const handle = uploadObject({ ...job, onProgress });
         job.abort = handle.abort;
         await handle.done;
         if (owns())
            setEntry(id, {
               status: "completed",
               uploadedBytes: job.file.size,
            });
      } catch (error) {
         if (!owns()) return;
         if (isCancelled(error) || get().entries[id]?.status === "cancelled") {
            setEntry(id, { status: "cancelled" });
         } else {
            setEntry(id, {
               status: "failed",
               error: error instanceof Error ? error.message : "Upload failed",
            });
            const { batch } = get();
            if (isFolderRefusal(error) && batch && batch.refusal === null)
               set({ batch: { ...batch, refusal: error.message } });
         }
      } finally {
         if (owns()) {
            jobs.delete(id);
            batchCallbacks.get(scope)?.open.delete(id);
            flushScopeIfIdle(scope);
         }
         pump();
      }
   };

   const pump = () => {
      const slots = FILE_CONCURRENCY - (jobs.size - queued());
      const next = slots > 0 ? dequeue(slots) : [];
      if (next.length > 0) {
         const { entries } = get();
         for (const id of next) {
            const entry = entries[id];
            if (entry) entries[id] = { ...entry, status: "active" };
         }
         set(bumpStatus);
         for (const id of next) {
            const worker = runJob(id);
            workers.add(worker);
            void worker.then(
               () => workers.delete(worker),
               () => workers.delete(worker)
            );
         }
      }
      settleBatchIfDone();
   };

   const cancelMany = (ids: readonly string[]) => {
      const aborts: Job[] = [];
      const { entries, progress } = get();
      const dequeuedScopes = new Set<string>();
      let changed = false;
      let dequeued = false;
      for (const id of ids) {
         const entry = entries[id];
         if (!entry || !isOpen(entry.status)) continue;
         const job = jobs.get(id);
         if (entry.status === "pending") {
            jobs.delete(id);
            dequeued = true;
            if (job) {
               batchCallbacks.get(scopeOf(job))?.open.delete(id);
               dequeuedScopes.add(scopeOf(job));
            }
         } else if (job) aborts.push(job);
         entries[id] = {
            ...entry,
            uploadedBytes: progress[id] ?? entry.uploadedBytes,
            status: "cancelled",
         };
         delete progress[id];
         changed = true;
      }
      if (dequeued) {
         queue = queue
            .slice(queueHead)
            .filter((id) => entries[id]?.status === "pending");
         queueHead = 0;
      }
      if (changed) set(bumpStatus);
      for (const scope of dequeuedScopes) flushScopeIfIdle(scope);
      for (const job of aborts) job.abort?.();
      pump();
   };

   return {
      entries: {},
      progress: {},
      order: [],
      batch: null,
      isUploading: false,
      statusVersion: 0,

      enqueue: ({ files, serverId, bucketName, prefix, eTags, onSettled }) => {
         if (files.length === 0 || uploadsSuspended()) return;
         const userId = useSessionStore.getState().userId;
         if (!userId) return;

         const deduped = new Map<string, UploadFile>();
         let collisions = 0;
         for (const entry of files) {
            const id = entryId(
               serverId,
               bucketName,
               `${prefix}${entry.relativePath}`
            );
            if (deduped.has(id)) collisions++;
            deduped.set(id, entry);
         }
         const scope = batchScope(userId, serverId, bucketName);
         const existing = batchCallbacks.get(scope);
         if (onSettled && existing) existing.callback = onSettled;
         else if (onSettled)
            batchCallbacks.set(scope, {
               callback: onSettled,
               keys: new Map(),
               open: new Set(),
               enqueuing: 0,
            });
         const tracked = batchCallbacks.get(scope);
         if (collisions > 0) {
            toast.error(
               collisions === 1
                  ? "One file shares a name with another in this drop. Only the last was queued."
                  : `${collisions} files share a name with another in this drop. Only the last of each was queued.`
            );
         }

         const generation = enqueueGeneration;
         const inBatch = new Set<string>();
         activeEnqueues++;
         if (tracked) tracked.enqueuing++;
         void (async () => {
            try {
               for (const slice of chunk(
                  [...deduped.values()],
                  ENQUEUE_CHUNK_SIZE
               )) {
                  if (
                     generation !== enqueueGeneration ||
                     useSessionStore.getState().userId !== userId
                  )
                     return;
                  const state = get();
                  const { entries, progress } = state;
                  const batch: UploadBatch =
                     !state.batch || state.batch.settled
                        ? {
                             ids: [],
                             settled: false,
                             completed: 0,
                             failed: 0,
                             refusal: null,
                          }
                        : { ...state.batch };
                  const order = [...state.order];
                  if (inBatch.size !== batch.ids.length) {
                     inBatch.clear();
                     for (const id of batch.ids) inBatch.add(id);
                  }
                  for (const { file, relativePath } of slice) {
                     const objectKey = `${prefix}${relativePath}`;
                     const id = entryId(serverId, bucketName, objectKey);
                     const prev = entries[id];
                     if (prev && inBatch.has(id))
                        adjustBatchCounts(batch, prev.status, -1);
                     delete progress[id];
                     jobs.get(id)?.abort?.();
                     jobs.set(id, {
                        userId,
                        file,
                        serverId,
                        bucketName,
                        objectKey,
                        contentType: file.type || DEFAULT_CONTENT_TYPE,
                        expectedETag:
                           eTags && Object.hasOwn(eTags, objectKey)
                              ? eTags[objectKey]
                              : undefined,
                        abort: null,
                     });
                     entries[id] = {
                        id,
                        objectKey,
                        fileName: file.name,
                        relativePath,
                        size: file.size,
                        uploadedBytes: 0,
                        status: "pending",
                        error: null,
                     };
                     tracked?.open.add(id);
                     if (!prev) order.push(id);
                     if (prev?.status !== "pending") queue.push(id);
                     if (!inBatch.has(id)) {
                        inBatch.add(id);
                        batch.ids.push(id);
                     }
                  }
                  set((state) => ({
                     ...bumpStatus(state),
                     batch,
                     order,
                     isUploading: true,
                  }));
                  pump();
                  if (slice.length === ENQUEUE_CHUNK_SIZE)
                     await yieldToEventLoop();
               }
            } finally {
               activeEnqueues--;
               if (tracked) {
                  tracked.enqueuing--;
                  flushScopeIfIdle(scope);
               }
               pump();
            }
         })();
      },

      cancel: (id) => cancelMany([id]),

      cancelAll: () => {
         enqueueGeneration++;
         cancelMany(get().order);
      },

      cancelAllAndClear: () => {
         get().cancelAll();
         jobs.clear();
         flushBatchCallbacks();
         queue = [];
         queueHead = 0;
         set((state) => ({
            ...bumpStatus(state),
            entries: {},
            progress: {},
            order: [],
            batch: null,
            isUploading: false,
         }));
         return Promise.allSettled([...workers]).then(() => undefined);
      },
   };
});

registerUploadReset(
   () => useUploadStore.getState().cancelAllAndClear(),
   () => useUploadStore.getState().isUploading
);

useSessionStore.subscribe((state, previous) => {
   if (state.userId !== previous.userId)
      useUploadStore.getState().cancelAllAndClear();
});

const openKeysCache = new Map<
   string,
   { version: number; keys: ReadonlySet<string> }
>();

// cached per scope and status version so the snapshot stays stable across progress ticks
const selectOpenUploadKeys =
   (serverId: string, bucketName: string) =>
   (state: UploadState): ReadonlySet<string> => {
      const scope = JSON.stringify([serverId, bucketName]);
      const cached = openKeysCache.get(scope);
      if (cached?.version === state.statusVersion) return cached.keys;
      const keys = openUploadKeys(state.entries, serverId, bucketName);
      openKeysCache.set(scope, { version: state.statusVersion, keys });
      return keys;
   };

const useOpenUploadKeys = (serverId: string, bucketName: string) =>
   useUploadStore(selectOpenUploadKeys(serverId, bucketName));

export { selectOpenUploadKeys, useOpenUploadKeys };
export default useUploadStore;
