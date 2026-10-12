import type { BucketTarget } from "@/lib/types";
import { yieldToEventLoop } from "@/lib/utils/yield-to-event-loop";
import { isFolderRefusal } from "@/lib/utils/folder-refusal";
import { pluralize } from "@/lib/utils/format";
import { chunk, DEFAULT_CONTENT_TYPE } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { UploadFile } from "@/lib/utils/s3/drop-entries";
import { isCancelled } from "@/lib/utils/s3/upload-cancelled";
import { uploadObject } from "@/lib/utils/s3/upload-object";
import useSessionStore from "@/lib/stores/session-store";
import { registerUploadReset, uploadsSuspended } from "./lifecycle";
import type { UploadBatch, UploadEntry } from "./types";

const FILE_CONCURRENCY = 3;
const MIN_PROGRESS_STEP = 64 * 1024;
const PROGRESS_STEPS = 100;
const ENQUEUE_CHUNK_SIZE = 200;
const COMPLETED_HISTORY_LIMIT = 1000;

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
const batchCallbacks = new Map<
   string,
   { callback: Settlement; keys: Map<string, string> }
>();
let enqueueGeneration = 0;
let activeEnqueues = 0;

const batchScope = (userId: string, serverId: string, bucketName: string) =>
   JSON.stringify([userId, serverId, bucketName]);

const flushBatchCallbacks = () => {
   const callbacks = [...batchCallbacks.values()].map(({ callback, keys }) => ({
      callback,
      keys: [...keys.values()],
   }));
   batchCallbacks.clear();
   for (const { callback, keys } of callbacks) if (keys.length) callback(keys);
};

const isOpen = (status: UploadEntry["status"]) =>
   status === "pending" || status === "active";

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
   queue: string[];
   batch: UploadBatch | null;
   isUploading: boolean;
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

const entryId = (serverId: string, bucketName: string, objectKey: string) =>
   JSON.stringify([serverId, bucketName, objectKey]);

const useUploadStore = create<UploadStore>()(
   immer((set, get) => {
      const setEntry = (id: string, patch: Partial<UploadEntry>) =>
         set((state) => {
            const entry = state.entries[id];
            if (!entry) return;
            if (patch.status && patch.status !== "active") {
               entry.uploadedBytes = state.progress[id] ?? entry.uploadedBytes;
               delete state.progress[id];
            }
            if (patch.status && state.batch) {
               adjustBatchCounts(state.batch, entry.status, -1);
               adjustBatchCounts(state.batch, patch.status, 1);
            }
            Object.assign(entry, patch);
         });

      const settleBatchIfDone = () => {
         const { batch, queue } = get();
         if (
            !batch ||
            batch.settled ||
            jobs.size > 0 ||
            queue.length > 0 ||
            activeEnqueues > 0
         )
            return;

         set((state) => {
            if (state.batch) state.batch.settled = true;
            state.isUploading = false;
         });

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
         const finished = get().order.filter(
            (id) => get().entries[id]?.status === "completed"
         );
         if (finished.length > COMPLETED_HISTORY_LIMIT) {
            const expired = new Set(
               finished.slice(0, -COMPLETED_HISTORY_LIMIT)
            );
            set((state) => {
               for (const id of expired) delete state.entries[id];
               state.order = state.order.filter((id) => !expired.has(id));
            });
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
            Math.max(
               MIN_PROGRESS_STEP,
               Math.ceil(job.file.size / PROGRESS_STEPS)
            )
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
            set((state) => {
               state.progress[id] = Math.min(loaded, job.file.size);
            });
         };

         try {
            batchCallbacks
               .get(batchScope(job.userId, job.serverId, job.bucketName))
               ?.keys.set(id, job.objectKey);
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
            if (
               isCancelled(error) ||
               get().entries[id]?.status === "cancelled"
            ) {
               setEntry(id, { status: "cancelled" });
            } else {
               setEntry(id, {
                  status: "failed",
                  error:
                     error instanceof Error ? error.message : "Upload failed",
               });
               if (isFolderRefusal(error))
                  set((state) => {
                     if (state.batch) state.batch.refusal ??= error.message;
                  });
            }
         } finally {
            if (owns()) jobs.delete(id);
            pump();
         }
      };

      const pump = () => {
         const { queue } = get();
         const slots = FILE_CONCURRENCY - (jobs.size - queue.length);
         const next = slots > 0 ? queue.slice(0, slots) : [];
         if (next.length > 0) {
            set((state) => {
               state.queue = state.queue.slice(next.length);
               for (const id of next) {
                  const entry = state.entries[id];
                  if (entry) entry.status = "active";
               }
            });
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
         set((state) => {
            let dequeued = false;
            for (const id of ids) {
               const entry = state.entries[id];
               if (!entry || !isOpen(entry.status)) continue;
               const job = jobs.get(id);
               if (entry.status === "pending") {
                  jobs.delete(id);
                  dequeued = true;
               } else if (job) aborts.push(job);
               entry.uploadedBytes = state.progress[id] ?? entry.uploadedBytes;
               delete state.progress[id];
               entry.status = "cancelled";
            }
            if (dequeued)
               state.queue = state.queue.filter(
                  (id) => state.entries[id]?.status === "pending"
               );
         });
         for (const job of aborts) job.abort?.();
         pump();
      };

      return {
         entries: {},
         progress: {},
         order: [],
         queue: [],
         batch: null,
         isUploading: false,

         enqueue: ({
            files,
            serverId,
            bucketName,
            prefix,
            eTags,
            onSettled,
         }) => {
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
            if (onSettled) {
               const scope = batchScope(userId, serverId, bucketName);
               const keys =
                  batchCallbacks.get(scope)?.keys ?? new Map<string, string>();
               batchCallbacks.set(scope, { callback: onSettled, keys });
            }
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
                     set((state) => {
                        const batch =
                           !state.batch || state.batch.settled
                              ? {
                                   ids: [],
                                   settled: false,
                                   completed: 0,
                                   failed: 0,
                                   refusal: null,
                                }
                              : state.batch;
                        if (inBatch.size !== batch.ids.length) {
                           inBatch.clear();
                           for (const id of batch.ids) inBatch.add(id);
                        }
                        state.batch = batch;
                        state.isUploading = true;
                        for (const { file, relativePath } of slice) {
                           const objectKey = `${prefix}${relativePath}`;
                           const id = entryId(serverId, bucketName, objectKey);
                           const prev = state.entries[id];
                           if (prev && inBatch.has(id))
                              adjustBatchCounts(batch, prev.status, -1);
                           delete state.progress[id];
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
                           state.entries[id] = {
                              id,
                              fileName: file.name,
                              relativePath,
                              size: file.size,
                              uploadedBytes: 0,
                              status: "pending",
                              error: null,
                           };
                           if (!prev) state.order.push(id);
                           if (prev?.status !== "pending") state.queue.push(id);
                           if (!inBatch.has(id)) {
                              inBatch.add(id);
                              batch.ids.push(id);
                           }
                        }
                     });
                     pump();
                     if (slice.length === ENQUEUE_CHUNK_SIZE)
                        await yieldToEventLoop();
                  }
               } finally {
                  activeEnqueues--;
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
            set((state) => {
               state.entries = {};
               state.progress = {};
               state.order = [];
               state.queue = [];
               state.batch = null;
               state.isUploading = false;
            });
            return Promise.allSettled([...workers]).then(() => undefined);
         },
      };
   })
);

registerUploadReset(() => useUploadStore.getState().cancelAllAndClear());

useSessionStore.subscribe((state, previous) => {
   if (state.userId !== previous.userId)
      useUploadStore.getState().cancelAllAndClear();
});

export default useUploadStore;
