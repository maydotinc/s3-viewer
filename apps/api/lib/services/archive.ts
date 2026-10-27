import { S3_ROUTE_TIMEOUT_MS } from "@/lib/constants";
import { env } from "@/lib/env";
import { ApiHttpError, httpFailureOf } from "@/lib/http";
import { logger } from "@/lib/logger";
import {
   archiveFilename,
   collectArchiveEntries,
   type ArchiveEntry,
   type ArchiveLimits,
} from "@/lib/s3/archive/entries";
import { archiveDeadlineMs, streamArchive } from "@/lib/s3/archive/stream";
import {
   createArchiveTicket,
   failArchiveTicket,
   takeArchiveTicket,
   type ArchiveTicket,
   type TicketBinding,
} from "@/lib/s3/archive/ticket";
import type { S3Scope } from "@/lib/s3/listing";
import { SlotExpiredError } from "@/lib/s3/progress-floor";
import { UPLOAD_SLOT_MAX_MS } from "@/lib/s3/upload-budget";
import {
   Role,
   describeError,
   hasDotSegment,
   type S3ArchiveTicket,
} from "@s3-viewer/shared";
import type { Writable } from "node:stream";

type ArchiveTenant = { userId: string; serverId: string };
type ArchiveScope = S3Scope & { tenant: ArchiveTenant };

const archiveLimits = (): ArchiveLimits => ({
   maxObjects: env.MAX_ARCHIVE_OBJECTS,
   maxBytes: env.MAX_ARCHIVE_BYTES,
});

const assertZippable = (
   serverRole: Role,
   entries: readonly ArchiveEntry[]
): void => {
   if (serverRole === Role.OWNER) return;
   const dotted = entries.find(({ key }) => hasDotSegment(key));
   if (dotted) {
      throw new ApiHttpError(
         409,
         `This selection includes ${dotted.key}, and paths with . or .. segments can only be downloaded by the server owner. Deselect it and try again.`
      );
   }
};

const issueArchiveTicket = async (
   scope: ArchiveScope,
   objectKeys: readonly string[],
   serverRole: Role
): Promise<S3ArchiveTicket> => {
   const { userId, serverId } = scope.tenant;
   const { entries, fileSizes } = await collectArchiveEntries(
      scope,
      objectKeys,
      archiveLimits()
   );
   assertZippable(serverRole, entries);
   const { token, expiresAt } = await createArchiveTicket({
      userId,
      serverId,
      bucket: scope.bucket,
      objectKeys,
      fileSizes,
      manifest: entries.map(({ key, size }) => [key, size] as const),
   });
   return {
      token,
      expiresAt: expiresAt.toISOString(),
      filename: archiveFilename(scope.bucket, objectKeys),
   };
};

type ArchiveDownload = {
   scope: ArchiveScope;
   ticket: ArchiveTicket;
   token: string;
   binding: TicketBinding;
   serverRole: Role;
   abortController: AbortController;
   output: Writable;
   // runs just before the first byte; the record can refuse with "try again", so the ticket is spent only after it.
   recordAttempt: (detail: {
      objects: number;
      estimatedBytes: number;
   }) => Promise<void>;
   onStart: () => void;
   // throws to answer the failure, or returns once a response already under way has been cut off.
   onFailure: (error: unknown) => void;
};

const downloadArchive = async ({
   scope,
   ticket,
   token,
   binding,
   serverRole,
   abortController,
   output,
   recordAttempt,
   onStart,
   onFailure,
}: ArchiveDownload): Promise<void> => {
   const limits = archiveLimits();
   const { entries, bytes } = await collectArchiveEntries(
      scope,
      ticket.objectKeys,
      limits,
      ticket.fileSizes,
      ticket.manifest
   );
   assertZippable(serverRole, entries);
   abortController.signal.throwIfAborted();
   // a slot-expiry reason maps to the same 408 as an upload that outlives its slot, instead of a storage failure.
   const deadline = setTimeout(
      () =>
         abortController.abort(
            new SlotExpiredError("The download is too slow.")
         ),
      Math.min(
         UPLOAD_SLOT_MAX_MS,
         Math.max(S3_ROUTE_TIMEOUT_MS, archiveDeadlineMs(bytes, entries.length))
      )
   );
   deadline.unref();
   try {
      onStart();
      await streamArchive({
         scope,
         entries,
         output,
         abortController,
         maxBytes: limits.maxBytes,
         beforeOutput: async () => {
            await recordAttempt({
               objects: entries.length,
               estimatedBytes: bytes,
            });
            await takeArchiveTicket(token, binding);
         },
      });
   } catch (error) {
      logger.warn("Zip archive failed", {
         objects: entries.length,
         error: describeError(error),
      });
      onFailure(error);
   } finally {
      clearTimeout(deadline);
   }
};

const isCapacityRefusal = (error: unknown): boolean => {
   const status = httpFailureOf(error)?.status;
   return status === 429 || status === 503;
};

// a busy server says nothing about the ticket, so only other failures count toward retiring it.
const countFailedDownload = async (
   token: string,
   binding: TicketBinding,
   error: unknown
): Promise<void> => {
   if (isCapacityRefusal(error)) return;
   await failArchiveTicket(token, binding).catch((failure: unknown) => {
      logger.warn("Could not count a failed zip download", {
         error: describeError(failure),
      });
   });
};

export { countFailedDownload, downloadArchive, issueArchiveTicket };
