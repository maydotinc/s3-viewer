import type { S3Client, S3ClientConfig } from "@aws-sdk/client-s3";
import { AsyncLocalStorage } from "node:async_hooks";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import {
   BUFFER_MEMORY_FACTOR,
   readBudget,
   retainForResponse,
   type ReadReservation,
} from "./read-budget";
import { estimateXmlMemory, responseLimitError } from "./xml-response-guard";
import {
   BUFFERED_BODY_SLAB_OVERHEAD_BYTES,
   createBufferedBody,
} from "./buffered-body";

type StreamCollector = NonNullable<S3ClientConfig["streamCollector"]>;

const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const operationContext = new AsyncLocalStorage<{
   serverId: string;
   reservations: Set<ReadReservation>;
}>();
const bufferedResponses = new WeakMap<object, (() => void)[]>();

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

const responseTooLarge = (): Error =>
   responseLimitError("Storage response exceeded the size limit");

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
   try {
      reservation = readBudget.acquire({
         serverId: operation?.serverId ?? "unscoped",
      });
      operation?.reservations.add(reservation);
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
      for await (const chunk of readable) {
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
      if (!operation) reservation?.release();
   }
};

const withBufferedResponses = (
   client: S3Client,
   serverId: string
): S3Client => {
   client.config.streamCollector = cappedStreamCollector;
   client.middlewareStack.add(
      (next) => (args) =>
         operationContext.run(
            { serverId, reservations: new Set() },
            async () => {
               const operation = operationContext.getStore()!;
               let output: object | undefined;
               try {
                  const result = await next(args);
                  output = result.output;
                  return result;
               } finally {
                  // parsed results and queued HTTP output outlive SDK parsing.
                  const releases = [...operation.reservations].map(
                     retainForResponse
                  );
                  if (output && releases.length)
                     bufferedResponses.set(output, releases);
               }
            }
         ),
      { step: "initialize", name: "bufferedResponses", override: true }
   );
   return client;
};

export {
   cappedStreamCollector,
   MAX_RESPONSE_BYTES,
   releaseBufferedResponse,
   transferBufferedResponse,
   withBufferedResponses,
};
