import type { S3Client, S3ClientConfig } from "@aws-sdk/client-s3";
import { MIB, SECOND_MS } from "@s3-viewer/shared";
import { AsyncLocalStorage } from "node:async_hooks";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { StorageError } from "./errors";
import {
   BUFFER_MEMORY_FACTOR,
   readBudget,
   retainForResponse,
   type ReadReservation,
} from "./read-budget";
import { estimateXmlMemory, responseLimitExceeded } from "./xml-response-guard";
import {
   BUFFERED_BODY_SLAB_OVERHEAD_BYTES,
   createBufferedBody,
} from "./buffered-body";

type StreamCollector = NonNullable<S3ClientConfig["streamCollector"]>;

const MAX_RESPONSE_BYTES = 16 * MIB;
// commands storage acts on as soon as it receives them.
const COMMITTING_COMMANDS: ReadonlySet<string> = new Set([
   "AbortMultipartUploadCommand",
   "CompleteMultipartUploadCommand",
   "CopyObjectCommand",
   "CreateBucketCommand",
   "CreateMultipartUploadCommand",
   "DeleteObjectCommand",
   "DeleteObjectsCommand",
   "PutObjectCommand",
   "UploadPartCommand",
   "UploadPartCopyCommand",
]);
// past these a reply is holding a read slot, not using it.
const COLLECT_IDLE_MS = 10 * SECOND_MS;
const COLLECT_MAX_MS = 30 * SECOND_MS;
type Operation = {
   serverId: string;
   committing: boolean;
   reservations: Set<ReadReservation>;
   admitted?: ReadReservation;
};
const operationContext = new AsyncLocalStorage<Operation>();
const bufferedResponses = new WeakMap<object, (() => void)[]>();

const responseStalled = (): Error =>
   new StorageError("upstream", "Storage response stalled");

const stallWatch = (readable: Readable) => {
   const deadline = Date.now() + COLLECT_MAX_MS;
   let timer: NodeJS.Timeout | undefined;
   const touch = () => {
      clearTimeout(timer);
      timer = setTimeout(
         () => readable.destroy(responseStalled()),
         Math.min(COLLECT_IDLE_MS, deadline - Date.now())
      );
      timer.unref();
   };
   touch();
   return { touch, disarm: () => clearTimeout(timer) };
};

const transferBufferedResponse = <T extends object>(from: object, to: T): T => {
   const releases = bufferedResponses.get(from);
   if (releases) {
      bufferedResponses.delete(from);
      bufferedResponses.set(to, releases);
   }
   return to;
};

const releaseBufferedResponse = (output: object): void => {
   const releases = bufferedResponses.get(output);
   bufferedResponses.delete(output);
   for (const release of releases ?? []) release();
};

const withReleased = <T>(output: object, read: () => T): T => {
   try {
      return read();
   } finally {
      releaseBufferedResponse(output);
   }
};

const responseTooLarge = (): Error =>
   responseLimitExceeded("Storage response exceeded the size limit");

const toReadable = (
   stream: Parameters<StreamCollector>[0]
): Readable | null => {
   if (stream instanceof Readable) return stream;
   if (typeof (stream as Blob).arrayBuffer === "function") return null;
   return Readable.fromWeb(stream as WebReadableStream);
};

const cappedStreamCollector: StreamCollector = async (stream) => {
   const readable = toReadable(stream);
   const operation = operationContext.getStore();
   let reservation: ReadReservation | undefined;
   const drop = (): void => {
      if (!reservation) return;
      reservation.release();
      operation?.reservations.delete(reservation);
   };
   let watch: ReturnType<typeof stallWatch> | undefined;
   try {
      if (operation?.admitted) {
         reservation = operation.admitted;
         operation.admitted = undefined;
      } else {
         reservation = readBudget.acquire({
            serverId: operation?.serverId ?? "unscoped",
            committed: operation?.committing,
         });
         operation?.reservations.add(reservation);
      }
      if (operation?.committing) reservation.commit();
      if (!readable) {
         const blob = stream as Blob;
         if (blob.size > MAX_RESPONSE_BYTES) throw responseTooLarge();
         if (blob.size)
            reservation.retain(
               blob.size * BUFFER_MEMORY_FACTOR +
                  BUFFERED_BODY_SLAB_OVERHEAD_BYTES
            );
         const result = new Uint8Array(await blob.arrayBuffer());
         reservation.retain(estimateXmlMemory(result));
         if (!blob.size) drop();
         return result;
      }
      const collected = createBufferedBody(reservation);
      let size = 0;
      watch = stallWatch(readable);
      for await (const chunk of readable) {
         watch.touch();
         const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
         size += buffer.length;
         if (size > MAX_RESPONSE_BYTES) throw responseTooLarge();
         collected.append(buffer);
      }
      if (!size) drop();
      const result = collected.toBuffer();
      if (size) reservation.retain(estimateXmlMemory(result));
      return new Uint8Array(
         result.buffer,
         result.byteOffset,
         result.byteLength
      );
   } catch (error) {
      readable?.destroy();
      drop();
      throw error;
   } finally {
      watch?.disarm();
      if (!operation) reservation?.release();
   }
};

// a write refused only once its response arrives has already landed, so a budgeted client takes the
// slot before sending and its response uses it; an abort is cleanup, and the unbudgeted clones carry
// tails of writes already committed.
const admitCommittingWrite = (serverId: string, command = ""): void => {
   if (
      !COMMITTING_COMMANDS.has(command) ||
      command === "AbortMultipartUploadCommand"
   )
      return;
   const reservation = readBudget.acquire({ serverId });
   const operation = operationContext.getStore();
   if (!operation) {
      reservation.release();
      return;
   }
   operation.admitted = reservation;
   operation.reservations.add(reservation);
};

const withBufferedResponses = (
   client: S3Client,
   serverId: string
): S3Client => {
   client.config.streamCollector = cappedStreamCollector;
   client.middlewareStack.add(
      (next, context) => (args) => {
         const committing = COMMITTING_COMMANDS.has(context.commandName ?? "");
         return operationContext.run(
            { serverId, committing, reservations: new Set() },
            async () => {
               const operation = operationContext.getStore()!;
               let output: object | undefined;
               try {
                  const result = await next(args);
                  output = result.output;
                  return result;
               } finally {
                  if (operation.admitted) {
                     operation.reservations.delete(operation.admitted);
                     operation.admitted.release();
                  }
                  // parsed results and queued HTTP output outlive SDK parsing.
                  const releases = [...operation.reservations].map(
                     retainForResponse
                  );
                  if (output && releases.length)
                     bufferedResponses.set(output, releases);
               }
            }
         );
      },
      { step: "initialize", name: "bufferedResponses", override: true }
   );
   return client;
};

export {
   admitCommittingWrite,
   cappedStreamCollector,
   MAX_RESPONSE_BYTES,
   releaseBufferedResponse,
   transferBufferedResponse,
   withBufferedResponses,
   withReleased,
};
