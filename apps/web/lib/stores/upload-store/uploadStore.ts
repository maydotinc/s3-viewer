import { DEFAULT_CONTENT_TYPE } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { UploadFile } from "@/lib/utils/s3/dropEntries";
import { isCancelled } from "@/lib/utils/s3/upload-cancelled";
import { uploadObject } from "@/lib/utils/s3/uploadObject";
import type { UploadBatch, UploadEntry } from "./types";

const FILE_CONCURRENCY = 3;

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
            if (entry) Object.assign(entry, patch);
         });

      const settleBatchIfDone = () => {
         const { batch, entries, queue } = get();
         if (!batch || batch.settled) return;
         const members = batch.ids
            .map((id) => entries[id])
            .filter(Boolean) as UploadEntry[];
         const unfinished = members.some(
            (entry) => entry.status === "pending" || entry.status === "active"
         );
         if (unfinished || queue.length > 0) return;

         set((state) => {
            if (state.batch) state.batch.settled = true;
            state.isUploading = false;
         });

         const completed = members.filter(
            (e) => e.status === "completed"
         ).length;
         const failed = members.filter((e) => e.status === "failed").length;
         const total = members.length;
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
         const onProgress = (loaded: number) => {
            if (owns())
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
         const { queue, entries } = get();
         const active = Object.values(entries).filter(
            (e) => e.status === "active"
         ).length;
         const slots = FILE_CONCURRENCY - active;
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
               const startNewBatch = !state.batch || state.batch.settled;
               if (startNewBatch) state.batch = { ids: [], settled: false };
               state.isUploading = true;
               for (const { file, relativePath } of files) {
                  const objectKey = `${prefix}${relativePath}`;
                  const id = entryId(bucketName, objectKey);
                  const existing = jobs.get(id);
                  if (existing) existing.abort?.();
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
                  if (!state.order.includes(id)) state.order.push(id);
                  if (!state.queue.includes(id)) state.queue.push(id);
                  if (state.batch && !state.batch.ids.includes(id))
                     state.batch.ids.push(id);
               }
            });
            pump();
         },

         cancel: (id) => {
            const entry = get().entries[id];
            if (
               !entry ||
               entry.status === "completed" ||
               entry.status === "cancelled"
            )
               return;
            if (entry.status === "pending") jobs.delete(id);
            else jobs.get(id)?.abort?.();
            set((state) => {
               state.queue = state.queue.filter((queued) => queued !== id);
               const target = state.entries[id];
               if (target) target.status = "cancelled";
            });
            pump();
         },

         cancelAll: () => {
            for (const id of get().order) get().cancel(id);
         },

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
