import { DEFAULT_CONTENT_TYPE } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { UploadFile } from "@/lib/utils/s3/dropEntries";
import { isCancelled } from "@/lib/utils/s3/upload-cancelled";
import { uploadObject } from "@/lib/utils/s3/uploadObject";
import type { UploadBatch, UploadEntry } from "./types";

const FILE_CONCURRENCY = 3;
const MIN_PROGRESS_STEP = 64 * 1024;
const PROGRESS_STEPS = 100;

type Job = {
   file: File;
   serverId: string;
   bucketName: string;
   objectKey: string;
   contentType: string;
   abort: (() => void) | null;
};

const jobs = new Map<string, Job>();
const batchCallbacks = new Set<() => void>();

const isOpen = (status: UploadEntry["status"]) =>
   status === "pending" || status === "active";

const count = (
   batch: UploadBatch,
   status: UploadEntry["status"],
   by: 1 | -1
) => {
   if (status === "completed") batch.completed += by;
   else if (status === "failed") batch.failed += by;
};

type UploadState = {
   entries: Record<string, UploadEntry>;
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
      onComplete?: () => void;
   }) => void;
   cancel: (id: string) => void;
   cancelAll: () => void;
   dismiss: () => void;
};

type UploadStore = UploadState & UploadActions;

const entryId = (bucketName: string, objectKey: string) =>
   `${bucketName}/${objectKey}`;

const useUploadStore = create<UploadStore>()(
   immer((set, get) => {
      const setEntry = (id: string, patch: Partial<UploadEntry>) =>
         set((state) => {
            const entry = state.entries[id];
            if (!entry) return;
            if (patch.status && state.batch) {
               count(state.batch, entry.status, -1);
               count(state.batch, patch.status, 1);
            }
            Object.assign(entry, patch);
         });

      const settleBatchIfDone = () => {
         const { batch, queue } = get();
         if (!batch || batch.settled || jobs.size > 0 || queue.length > 0)
            return;

         set((state) => {
            if (state.batch) state.batch.settled = true;
            state.isUploading = false;
         });

         const { completed, failed } = batch;
         const total = batch.ids.length;
         if (failed > 0) {
            toast.error(
               `${completed} of ${total} ${total === 1 ? "file" : "files"} uploaded. ${failed} failed.`
            );
         } else if (completed > 0) {
            toast.success(
               completed === 1
                  ? "File uploaded."
                  : `${completed} files uploaded.`
            );
         }
         const callbacks = [...batchCallbacks];
         batchCallbacks.clear();
         if (completed > 0) for (const callback of callbacks) callback();
      };

      const runJob = async (id: string) => {
         const job = jobs.get(id);
         if (!job) return;
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
            if (!owns() || (loaded >= reported && loaded - reported < step))
               return;
            reported = loaded;
            setEntry(id, { uploadedBytes: Math.min(loaded, job.file.size) });
         };

         try {
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
            for (const id of next) void runJob(id);
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
         order: [],
         queue: [],
         batch: null,
         isUploading: false,

         enqueue: ({ files, serverId, bucketName, prefix, onComplete }) => {
            if (files.length === 0) return;
            if (onComplete) batchCallbacks.add(onComplete);
            set((state) => {
               const batch =
                  !state.batch || state.batch.settled
                     ? { ids: [], settled: false, completed: 0, failed: 0 }
                     : state.batch;
               const inBatch = new Set(batch.ids);
               state.batch = batch;
               state.isUploading = true;
               for (const { file, relativePath } of files) {
                  const objectKey = `${prefix}${relativePath}`;
                  const id = entryId(bucketName, objectKey);
                  const prev = state.entries[id];
                  if (prev && inBatch.has(id)) count(batch, prev.status, -1);
                  jobs.get(id)?.abort?.();
                  jobs.set(id, {
                     file,
                     serverId,
                     bucketName,
                     objectKey,
                     contentType: file.type || DEFAULT_CONTENT_TYPE,
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
         },

         cancel: (id) => cancelMany([id]),

         cancelAll: () => cancelMany(get().order),

         dismiss: () => {
            get().cancelAll();
            jobs.clear();
            batchCallbacks.clear();
            set((state) => {
               state.entries = {};
               state.order = [];
               state.queue = [];
               state.batch = null;
               state.isUploading = false;
            });
         },
      };
   })
);

export default useUploadStore;
