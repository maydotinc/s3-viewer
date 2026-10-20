import {
   ARCHIVE_DRAIN_FLOOR_FRACTION,
   ARCHIVE_MIN_BYTES_PER_SECOND,
   ARCHIVE_MS_PER_OBJECT,
   STREAM_IDLE_TIMEOUT_MS,
} from "@/lib/constants";
import { ApiHttpError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { abortReason, noop } from "@/lib/utils/abort";
import { MIB, describeError, SECOND_MS } from "@s3-viewer/types";
import {
   GetObjectCommand,
   type GetObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { ZipArchive } from "archiver";
import { Transform, type Readable, type Writable } from "node:stream";
import { throwHttpError } from "../errors";
import { assertObjectSize, keyHash } from "../keys";
import type { S3Scope } from "../listing";
import { progressFloor } from "../progress-floor";
import type { ArchiveEntry } from "./entries";

const archiveWorkMs = (bytes: number, objects: number): number =>
   (bytes / ARCHIVE_MIN_BYTES_PER_SECOND) * SECOND_MS +
   objects * ARCHIVE_MS_PER_OBJECT;

// the time the drain floor itself allows: a client holding exactly the floor must be able to finish.
const archiveDeadlineMs = (bytes: number, objects: number): number =>
   archiveWorkMs(bytes, objects) / ARCHIVE_DRAIN_FLOOR_FRACTION;

const flushed = (output: Writable): Promise<void> =>
   output.writableFinished
      ? Promise.resolve()
      : new Promise((resolve) => {
           const done = (): void => {
              output.off("finish", done);
              output.off("close", done);
              output.off("error", done);
              resolve();
           };
           output.once("finish", done);
           output.once("close", done);
           output.once("error", done);
        });

type StreamArchiveArgs = {
   scope: S3Scope;
   entries: readonly ArchiveEntry[];
   output: Writable;
   abortController: AbortController;
   maxBytes: number;
   idleTimeoutMs?: number;
   beforeOutput?: () => Promise<void>;
};

// prefetched bodies stay paused, so each buffers one stream chunk whatever its size:
// a few hundred KiB in all, well inside the zip slot's part-buffer reservation.
const PREFETCH_WINDOW = 8;
// bounds how long a paused body idles on its socket behind the entries before it.
const PREFETCH_AHEAD_BYTES = 8 * MIB;

const metered = (count: (chunk: Buffer) => void): Transform =>
   new Transform({
      transform(chunk: Buffer, _encoding, done) {
         try {
            count(chunk);
            done(null, chunk);
         } catch (error) {
            done(error instanceof Error ? error : new Error(String(error)));
         }
      },
   });

const streamArchive = async ({
   scope,
   entries,
   output,
   abortController,
   maxBytes,
   idleTimeoutMs = STREAM_IDLE_TIMEOUT_MS,
   beforeOutput,
}: StreamArchiveArgs): Promise<number> => {
   const { signal } = abortController;
   const archive = new ZipArchive({
      store: true,
      zlib: { level: 0 },
      forceZip64: true,
   });
   const failed = new Promise<never>((_, reject) => {
      archive.on("error", reject);
   });
   failed.catch(noop);
   const { promise: aborted, reject: rejectAborted } =
      Promise.withResolvers<never>();
   aborted.catch(noop);

   let bytesRead = 0;
   const bodies = new Set<Readable>();
   const pending = new Map<
      number,
      Promise<{ body: Readable; object: GetObjectCommandOutput }>
   >();
   let current: { body: Readable; timed?: Transform } | undefined;
   const onBodyError = (error: Error): void => abortController.abort(error);
   const onAbort = (): void => {
      const reason = abortReason(signal, "The download was cancelled.");
      rejectAborted(reason);
      current?.timed?.destroy(reason);
      for (const body of bodies) body.destroy(reason);
   };
   signal.addEventListener("abort", onAbort, { once: true });
   const fetchEntry = async (entry: ArchiveEntry) => {
      const object = await scope.client
         .send(new GetObjectCommand({ Bucket: scope.bucket, Key: entry.key }), {
            abortSignal: signal,
         })
         .catch(throwHttpError);
      const body = object.Body as Readable | undefined;
      if (!body) throw new ApiHttpError(502, "Storage returned no body.");
      body.on("error", noop);
      if (signal.aborted) {
         body.destroy();
         signal.throwIfAborted();
      }
      body.pause();
      body.on("error", onBodyError);
      bodies.add(body);
      return { body, object };
   };
   const prefetch = (index: number): void => {
      let ahead = 0;
      for (let offset = 0; offset < PREFETCH_WINDOW; offset++) {
         const entry = entries[index + offset];
         if (!entry) break;
         if (offset > 0) {
            ahead += entries[index + offset - 1]!.size;
            if (ahead > PREFETCH_AHEAD_BYTES) break;
         }
         if (pending.has(index + offset)) continue;
         const fetched = fetchEntry(entry).catch((error: unknown) => {
            abortController.abort(error);
            throw error;
         });
         fetched.catch(noop);
         pending.set(index + offset, fetched);
      }
   };
   const drain = progressFloor({
      abortController,
      windowMs: idleTimeoutMs,
      floor: idleTimeoutMs * ARCHIVE_DRAIN_FLOOR_FRACTION,
   });
   let draining = false;
   const sent = metered((chunk) => {
      if (!draining) {
         draining = true;
         drain.open();
      }
      drain.add(archiveWorkMs(chunk.length, 0));
   });
   sent.on("error", noop);
   archive.pipe(sent).pipe(output);

   try {
      drain.open();
      for (const [index, entry] of entries.entries()) {
         signal.throwIfAborted();
         prefetch(index);
         const { body, object } = await Promise.race([
            pending.get(index)!,
            failed,
            aborted,
         ]);
         current = { body };
         signal.throwIfAborted();
         if (object.ContentLength !== undefined)
            assertObjectSize(object.ContentLength);
         if ((object.ContentLength ?? 0) > maxBytes - bytesRead)
            throw new ApiHttpError(
               413,
               "This archive exceeds the download byte limit."
            );
         if (index === 0 && beforeOutput) {
            await beforeOutput();
            signal.throwIfAborted();
         }
         const read = progressFloor({
            abortController,
            windowMs: idleTimeoutMs,
            body,
         });
         const timed = metered((chunk) => {
            if (chunk.length > maxBytes - bytesRead) {
               const error = new ApiHttpError(
                  413,
                  "This archive exceeds the download byte limit."
               );
               abortController.abort(error);
               throw error;
            }
            bytesRead += chunk.length;
            read.add(chunk.length);
         });
         // destruction may emit an error after the append promise has settled.
         timed.on("error", noop);
         current = { body, timed };
         // archiver does not reject when an entry's source fails mid-stream.
         const appended = new Promise<void>((resolve, reject) => {
            const done = (error?: unknown): void => {
               archive.off("entry", onEntry);
               body.off("error", onBodyError);
               timed.off("error", onBodyError);
               if (error === undefined) resolve();
               else reject(error);
            };
            const onEntry = (): void => done();
            const onBodyError = (error: unknown): void => done(error);
            archive.once("entry", onEntry);
            body.once("error", onBodyError);
            timed.once("error", onBodyError);
         });
         archive.append(body.pipe(timed), { name: entry.name });
         try {
            read.open();
            if (signal.aborted) onAbort();
            await Promise.race([appended, failed, aborted]);
            drain.add(ARCHIVE_MS_PER_OBJECT);
         } catch (error) {
            logger.warn("Zip archive object failed", {
               key: keyHash(entry.key),
               error: describeError(error),
            });
            throw error;
         } finally {
            read.stop();
            pending.delete(index);
            body.off("error", onBodyError);
            bodies.delete(body);
         }
      }
      await Promise.race([archive.finalize(), failed, aborted]);
      await Promise.race([flushed(output), aborted]);
      return bytesRead;
   } catch (error) {
      abortController.abort(error);
      archive.unpipe(sent);
      sent.unpipe(output);
      archive.abort();
      current?.body.destroy();
      current?.timed?.destroy();
      throw error;
   } finally {
      drain.stop();
      signal.removeEventListener("abort", onAbort);
      for (const body of bodies) {
         body.off("error", onBodyError);
         body.destroy();
      }
   }
};

export {
   archiveDeadlineMs,
   PREFETCH_AHEAD_BYTES,
   PREFETCH_WINDOW,
   streamArchive,
};
