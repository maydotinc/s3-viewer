import {
   AbortMultipartUploadCommand,
   CompleteMultipartUploadCommand,
   CreateMultipartUploadCommand,
   PutObjectCommand,
   type PutObjectCommandInput,
   type S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Provider } from "@s3-viewer/types";
import { Transform, type Readable } from "node:stream";
import {
   CLEANUP_TIMEOUT_MS,
   UPLOAD_PART_QUEUE_SIZE,
   copyDeadlineMs,
} from "@/lib/constants";
import { ApiHttpError } from "@/lib/http";
import { abortReason } from "@/lib/utils/abort";
import {
   conditionalInitiation,
   sentMarker,
   UnconfirmedWriteError,
   uploadConflict,
   type WriteCondition,
} from "./conditions";
import { uploadLimitMessage } from "./errors";
import { describeFailure } from "./failure";
import { abortForCleanup } from "./multipart-uploads";
import { forCleanup, withoutRetries } from "./no-retry";
import {
   floorBytesFor,
   progressFloor,
   stallMsFor,
   StorageStalledError,
   UploadIdleError,
} from "./progress-floor";

const UPLOAD_ABORTED = "Upload aborted";

class UploadTooLargeError extends Error {
   readonly limit: number;

   constructor(limit: number) {
      super(uploadLimitMessage(limit));
      this.name = "UploadTooLargeError";
      this.limit = limit;
   }
}

const isUploadTooLargeError = (err: unknown): err is UploadTooLargeError =>
   err instanceof UploadTooLargeError;

const limitBytes = (
   limit: number,
   onChunk: (bytes: number) => void
): Transform => {
   let total = 0;
   return new Transform({
      transform(chunk, _encoding, done) {
         onChunk(chunk.length);
         total += chunk.length;
         if (total > limit) {
            done(new UploadTooLargeError(limit));
            return;
         }
         done(null, chunk);
      },
   });
};

type StreamThroughParams = {
   client: S3Client;
   provider: Provider;
   bucket: string;
   key: string;
   body: Readable;
   attributes: Partial<PutObjectCommandInput>;
   condition: WriteCondition;
   partSize: number;
   maxBytes: number;
   abortController: AbortController;
   idleTimeoutMs: number;
   conflictMessage: string;
   beforeCommit?: () => Promise<void>;
};

type StreamThroughResult = { size: number; eTag: string | null };

const streamThroughUpload = async ({
   client,
   provider,
   bucket,
   key,
   body,
   attributes,
   condition,
   partSize,
   maxBytes,
   abortController,
   idleTimeoutMs,
   conflictMessage,
   beforeCommit,
}: StreamThroughParams): Promise<StreamThroughResult> => {
   const cleanupClient = forCleanup(client);
   client = withoutRetries(client);
   let size = 0;
   const stalledAfterMs = stallMsFor(idleTimeoutMs, partSize);
   const floor = progressFloor({
      abortController,
      windowMs: idleTimeoutMs,
      floor: floorBytesFor(idleTimeoutMs),
      body,
      stall: {
         pausedMs: stalledAfterMs,
         endedMs: () => stalledAfterMs + copyDeadlineMs(size),
      },
   });
   const limiter = limitBytes(maxBytes, (bytes) => {
      size += bytes;
      floor.add(bytes);
   });
   // pipe() does not forward source errors to the destination.
   const onBodyError = (err: Error) => limiter.destroy(err);
   // lib-storage's abort() lets done() return before workers release buffers, so cancel input and requests ourselves.
   const onAbort = () =>
      limiter.destroy(abortReason(abortController.signal, UPLOAD_ABORTED));
   body.on("error", onBodyError);
   limiter.on("error", () => {
      body.unpipe(limiter);
      body.pause();
   });
   abortController.signal.addEventListener("abort", onAbort, { once: true });

   let cleanupConfirmed = false;
   let commitSent = () => false;
   const uploadClient = Object.create(client) as S3Client;
   uploadClient.send = (async (command: Parameters<S3Client["send"]>[0]) => {
      const cleanup = command instanceof AbortMultipartUploadCommand;
      if (
         command instanceof PutObjectCommand ||
         command instanceof CompleteMultipartUploadCommand
      ) {
         if (beforeCommit) await beforeCommit();
         commitSent = sentMarker(command);
      }
      if (
         command instanceof CreateMultipartUploadCommand &&
         provider !== Provider.S3
      )
         conditionalInitiation(command, condition);
      const result = await (cleanup ? cleanupClient : client).send(command, {
         abortSignal: cleanup
            ? AbortSignal.timeout(CLEANUP_TIMEOUT_MS)
            : abortController.signal,
      });
      if (cleanup) cleanupConfirmed = true;
      return result;
   }) as S3Client["send"];

   const upload = new Upload({
      client: uploadClient,
      params: {
         Bucket: bucket,
         Key: key,
         Body: body.pipe(limiter),
         ...attributes,
         ...condition,
      },
      partSize,
      queueSize: UPLOAD_PART_QUEUE_SIZE,
      leavePartsOnError: false,
   });

   try {
      floor.open();
      if (abortController.signal.aborted) onAbort();
      const out = await upload.done();
      return { size, eTag: out.ETag ?? null };
   } catch (err) {
      // lib-storage leaves parts after completion failures; clean up before releasing admission.
      if (upload.uploadId !== undefined && !cleanupConfirmed)
         await abortForCleanup({ client, bucket }, key, upload.uploadId);
      if (isUploadTooLargeError(limiter.errored)) throw limiter.errored;
      const { reason } = abortController.signal;
      if (
         reason instanceof UploadIdleError ||
         reason instanceof StorageStalledError
      )
         throw reason;
      // storage keeps a commit it received even when no answer comes back, so the caller must not retry blind.
      if (commitSent()) {
         const { httpStatus } = describeFailure(err);
         if (httpStatus === undefined || httpStatus >= 500)
            throw new UnconfirmedWriteError();
      }
      if (uploadConflict(err)) throw new ApiHttpError(409, conflictMessage);
      throw err;
   } finally {
      floor.stop();
      body.unpipe(limiter);
      body.off("error", onBodyError);
      abortController.signal.removeEventListener("abort", onAbort);
      limiter.destroy();
   }
};

export {
   isUploadTooLargeError,
   streamThroughUpload,
   UPLOAD_ABORTED,
   UploadTooLargeError,
};
