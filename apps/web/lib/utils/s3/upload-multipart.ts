import { ApiError, ClientErrorCode, isAborted } from "@/lib/api";
import useSessionStore from "@/lib/stores/session-store";
import { backoffMs, sleep } from "@/lib/utils/retry";
import {
   MAX_MULTIPART_PARTS,
   type S3ObjectUploaded,
   type S3UploadedPart,
} from "@s3-viewer/shared";
import {
   abortMultipartUpload,
   completeMultipartUpload,
   createMultipartUpload,
   listUploadedParts,
   putPart,
   type UploadRef,
   type UploadTarget,
} from "./multipart-api";
import {
   forgetPartDigest,
   forgetSession,
   rememberPartDigest,
   rememberSession,
   resumableSession,
   type MultipartSession,
} from "./multipart-session";
import { nextUploadJob, uploadSlot as withSlot } from "./slot-pool";
import { withMultipartLease } from "./multipart-locks";
import { UploadCancelledError } from "./upload-cancelled";
import {
   explainOpaqueFailure,
   isUnreadableAnswer,
   outcomeUnknown,
   type TransportHandle,
   type UploadParams,
} from "./upload-transport";

const PART_ATTEMPTS = 5;
const COMPLETE_ATTEMPTS = 3;
const RETRY_BACKOFF = { baseMs: 500, maxMs: 8_000, jitter: true } as const;

const sha256 = async (blob: Blob): Promise<string | null> => {
   try {
      const subtle = globalThis.crypto?.subtle;
      if (!subtle) return null;
      const digest = await subtle.digest("SHA-256", await blob.arrayBuffer());
      return Array.from(new Uint8Array(digest), (byte) =>
         byte.toString(16).padStart(2, "0")
      ).join("");
   } catch {
      return null;
   }
};

const isRetryable = (error: unknown): boolean =>
   error instanceof ApiError &&
   !isAborted(error) &&
   (error.status === 0 ||
      error.status === 408 ||
      error.status === 429 ||
      error.status >= 500);

type PartPlan = { partNumber: number; start: number; end: number };
type CommittedPart = { partNumber: number; eTag: string };
type OpenUpload = {
   session: MultipartSession;
   stored: S3UploadedPart[];
};

const uploadMultipart = ({
   userId,
   serverId,
   bucketName,
   objectKey,
   file,
   contentType,
   expectedETag,
   onProgress,
}: UploadParams): TransportHandle<S3ObjectUploaded> => {
   const target: UploadTarget = { serverId, bucketName, objectKey };
   const job = nextUploadJob();
   const controller = new AbortController();
   const inFlight = new Set<TransportHandle<S3UploadedPart>>();
   let ref: UploadRef | null = null;
   let persistent = false;
   let cleanup = Promise.resolve();

   const stopped = (): boolean =>
      controller.signal.aborted || useSessionStore.getState().userId !== userId;

   const resume = async (): Promise<OpenUpload | null> => {
      if (!persistent) return null;
      const { resumable: saved, stale } = await resumableSession({
         userId,
         target,
         file,
         expectedETag: expectedETag ?? null,
      });
      if (stale) {
         // the lease means no tab in this browser is still sending to it
         ref = { ...target, uploadId: stale.uploadId };
         await abandon();
      }
      if (!saved) return null;
      ref = { ...target, uploadId: saved.uploadId };
      if (stopped()) {
         await abandon();
         throw new UploadCancelledError();
      }
      try {
         if (
            !Number.isSafeInteger(saved.partSize) ||
            saved.partSize <= 0 ||
            saved.partCount !== Math.ceil(file.size / saved.partSize) ||
            saved.partCount < 1 ||
            saved.partCount > MAX_MULTIPART_PARTS
         ) {
            await abandon();
            return null;
         }
         const stored = (await listUploadedParts(ref)).filter((part) => {
            const start = (part.partNumber - 1) * saved.partSize;
            return (
               Number.isInteger(part.partNumber) &&
               part.partNumber >= 1 &&
               part.partNumber <= saved.partCount &&
               part.size === Math.min(saved.partSize, file.size - start)
            );
         });
         let verified = true;
         await Promise.all(
            stored.map((part) =>
               withSlot(job, async () => {
                  if (stopped()) throw new UploadCancelledError();
                  if (!verified) return;
                  const proof = saved.partDigests[part.partNumber];
                  if (
                     proof?.eTag !== part.eTag ||
                     typeof proof?.sha256 !== "string" ||
                     !/^[a-f0-9]{64}$/.test(proof.sha256)
                  ) {
                     verified = false;
                     return;
                  }
                  const start = (part.partNumber - 1) * saved.partSize;
                  if (
                     (await sha256(file.slice(start, start + part.size))) !==
                     proof.sha256
                  )
                     verified = false;
               })
            )
         );
         if (stopped()) throw new UploadCancelledError();
         if (!verified) {
            await abandon();
            return null;
         }
         const reused = new Set(stored.map((part) => part.partNumber));
         for (const number of Object.keys(saved.partDigests)) {
            const partNumber = Number(number);
            // invalidate before any overwrite, even an unacknowledged one; if that fails, use a new upload ID.
            if (
               !reused.has(partNumber) &&
               !(await forgetPartDigest(saved, partNumber))
            ) {
               await abandon();
               return null;
            }
            if (stopped()) throw new UploadCancelledError();
         }
         return { session: saved, stored };
      } catch (error) {
         if (stopped()) {
            await abandon();
            throw new UploadCancelledError();
         }
         if (isRetryable(error)) throw error;
         ref = null;
         await forgetSession(target, saved.uploadId);
         return null;
      }
   };

   const begin = async (): Promise<OpenUpload> => {
      if (stopped()) throw new UploadCancelledError();
      const { uploadId, partSize, partCount } = await createMultipartUpload(
         userId,
         target,
         { contentType, totalBytes: file.size, expectedETag }
      );
      const session: MultipartSession = {
         userId,
         ...target,
         uploadId,
         partSize,
         partCount,
         fileName: file.name,
         fileSize: file.size,
         lastModified: file.lastModified,
         expectedETag: expectedETag ?? null,
         savedAt: Date.now(),
         partDigests: {},
      };
      if (persistent && !stopped()) await rememberSession(session);
      return { session, stored: [] };
   };

   const abandon = (): Promise<void> => {
      const upload = ref;
      ref = null;
      if (!upload || useSessionStore.getState().userId !== userId)
         return cleanup;
      cleanup = cleanup.then(async () => {
         if (persistent) await forgetSession(target, upload.uploadId);
         if (useSessionStore.getState().userId !== userId) return;
         await abortMultipartUpload(userId, upload).catch(() => {});
      });
      return cleanup;
   };

   const run = async (): Promise<S3ObjectUploaded> => {
      if (stopped()) throw new UploadCancelledError();
      const opened = (await resume()) ?? (await begin());
      const upload: UploadRef = {
         ...target,
         uploadId: opened.session.uploadId,
      };
      ref = upload;
      if (stopped()) {
         await abandon();
         throw new UploadCancelledError();
      }

      const plan: PartPlan[] = Array.from(
         { length: opened.session.partCount },
         (_unused, index) => {
            const start = index * opened.session.partSize;
            return {
               partNumber: index + 1,
               start,
               end: Math.min(start + opened.session.partSize, file.size),
            };
         }
      );

      const committed = new Map<number, CommittedPart>();
      const inProgress = new Map<number, number>();
      let settledBytes = 0;
      const report = () => {
         let total = settledBytes;
         for (const bytes of inProgress.values()) total += bytes;
         onProgress(Math.min(total, file.size));
      };

      for (const part of opened.stored) {
         const planned = plan[part.partNumber - 1];
         if (!planned || part.size !== planned.end - planned.start) continue;
         committed.set(part.partNumber, {
            partNumber: part.partNumber,
            eTag: part.eTag,
         });
         settledBytes += part.size;
      }
      report();

      let failure: unknown;
      const ended = new AbortController();
      const end = () => ended.abort();
      if (controller.signal.aborted) end();
      else controller.signal.addEventListener("abort", end, { once: true });

      const digests = new Map<number, string | null>();
      const sendOnce = async (planned: PartPlan): Promise<void> => {
         const blob = file.slice(planned.start, planned.end);
         if (persistent && !digests.has(planned.partNumber))
            digests.set(planned.partNumber, await sha256(blob));
         if (stopped()) throw new UploadCancelledError();
         if (failure !== undefined) return;
         const handle = putPart(
            userId,
            upload,
            planned.partNumber,
            blob,
            (bytes) => {
               inProgress.set(planned.partNumber, bytes);
               report();
            }
         );
         inFlight.add(handle);
         try {
            const part = await handle.done;
            committed.set(planned.partNumber, {
               partNumber: planned.partNumber,
               eTag: part.eTag,
            });
            settledBytes += planned.end - planned.start;
            const digest = digests.get(planned.partNumber);
            if (persistent && digest && !stopped()) {
               await rememberPartDigest(opened.session, planned.partNumber, {
                  eTag: part.eTag,
                  sha256: digest,
               });
            }
         } finally {
            inFlight.delete(handle);
            inProgress.delete(planned.partNumber);
            report();
         }
      };

      // a slot per attempt, not per part, so parts in backoff can't park the whole pool.
      const send = async (planned: PartPlan): Promise<void> => {
         for (let attempt = 0; ; attempt++) {
            if (stopped()) throw new UploadCancelledError();
            if (failure !== undefined) return;
            try {
               await withSlot(job, async () => {
                  if (stopped()) throw new UploadCancelledError();
                  if (failure === undefined) await sendOnce(planned);
               });
               return;
            } catch (error) {
               if (attempt >= PART_ATTEMPTS - 1 || !isRetryable(error))
                  throw stopped() ? error : await explainOpaqueFailure(error);
               await sleep(backoffMs(attempt, RETRY_BACKOFF), ended.signal);
            }
         }
      };

      await Promise.allSettled(
         plan
            .filter(({ partNumber }) => !committed.has(partNumber))
            .map(async (planned) => {
               try {
                  await send(planned);
               } catch (error) {
                  if (failure === undefined) {
                     failure = error;
                     end();
                     for (const handle of inFlight) handle.abort();
                  }
                  throw error;
               }
            })
      );

      if (failure !== undefined) throw failure;

      const parts = plan.flatMap(({ partNumber }) => {
         const part = committed.get(partNumber);
         return part ? [part] : [];
      });
      if (parts.length !== plan.length)
         throw new ApiError(0, "Some parts of this file were never sent.");

      // a complete that failed in transit or on the server may have committed, so a retry's 404 or 409 proves nothing
      let ambiguous = false;
      for (let attempt = 0; ; attempt++) {
         if (stopped()) throw new UploadCancelledError();
         try {
            const uploaded = await completeMultipartUpload(
               userId,
               upload,
               parts,
               expectedETag
            );
            // a committed upload id must never be sent to abort.
            ref = null;
            if (persistent) await forgetSession(target, upload.uploadId);
            onProgress(file.size);
            return uploaded;
         } catch (error) {
            if (isUnreadableAnswer(error)) throw outcomeUnknown();
            const retryable = isRetryable(error);
            if (retryable && error instanceof ApiError && error.status !== 429)
               ambiguous = true;
            if (attempt >= COMPLETE_ATTEMPTS - 1 || !retryable)
               throw ambiguous ? outcomeUnknown() : error;
            await sleep(backoffMs(attempt, RETRY_BACKOFF), controller.signal);
         }
      }
   };

   const abort = () => {
      controller.abort();
      for (const handle of inFlight) handle.abort();
   };

   const done = withMultipartLease(userId, target, async (enabled) => {
      persistent = enabled;
      try {
         return await run();
      } catch (error) {
         // without a saved session nothing could resume these parts; an unknown outcome may still be committing
         if (
            !persistent &&
            !(
               error instanceof ApiError &&
               error.code === ClientErrorCode.UPLOAD_OUTCOME_UNKNOWN
            )
         )
            await abandon();
         throw error;
      } finally {
         if (stopped()) await abandon();
         await cleanup;
      }
   });
   return { done, abort };
};

export { uploadMultipart };
