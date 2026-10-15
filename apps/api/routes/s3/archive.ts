import { S3_ROUTE_TIMEOUT_MS, uploadMemoryFor } from "@/lib/constants";
import { env } from "@/lib/env";
import { ApiHttpError, isRateLimited } from "@/lib/http";
import { logger } from "@/lib/logger";
import { record } from "@/lib/middleware/audit-record";
import { assertInFolders, getAuth } from "@/lib/middleware/authorize";
import {
   archiveDownloadLimit,
   archiveLimit,
} from "@/lib/middleware/rate-limit";
import { bucketRoute, foldersCheckedInHandler } from "@/lib/middleware/route";
import { withUploadSlot } from "@/lib/middleware/upload-slot";
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
   readArchiveTicket,
   takeArchiveTicket,
} from "@/lib/s3/archive/ticket";
import { contentDispositionFilename } from "@/lib/s3/keys";
import { withoutRetries } from "@/lib/s3/no-retry";
import { UploadIdleError } from "@/lib/s3/progress-floor";
import { ARCHIVE_POOL, UPLOAD_SLOT_MAX_MS } from "@/lib/s3/upload-budget";
import { Permission } from "@s3-viewer/permissions";
import {
   OBJECT_MUTATION_PATH,
   Role,
   hasDotSegment,
   archiveDownloadParamsSchema,
   archiveRequestBodySchema,
   describeError,
   type S3ArchiveTicket,
} from "@s3-viewer/types";
import { Router, type Response } from "express";
import { readScope } from "./scope";

const archiveRouter = Router({ mergeParams: true });
const ARCHIVE_PATH = `${OBJECT_MUTATION_PATH}/archive`;

const archiveLimits = (): ArchiveLimits => ({
   maxObjects: env.MAX_ARCHIVE_OBJECTS,
   maxBytes: env.MAX_ARCHIVE_BYTES,
});

archiveRouter.post(
   ARCHIVE_PATH,
   archiveLimit,
   ...bucketRoute(
      Permission.DOWNLOAD_OBJECT,
      archiveRequestBodySchema,
      ({ objectKeys }) => objectKeys,
      async (_req, res, input) => {
         const { serverId, bucketName, objectKeys } = input;
         const { userId } = getAuth(res);
         const scope = await readScope(bucketName, res);
         const { entries, fileSizes } = await collectArchiveEntries(
            { ...scope, tenant: { userId, serverId } },
            objectKeys,
            archiveLimits()
         );
         assertZippable(res, entries);
         const filename = archiveFilename(bucketName, objectKeys);
         const { token, expiresAt } = await createArchiveTicket({
            userId,
            serverId,
            bucket: bucketName,
            objectKeys,
            fileSizes,
            manifest: entries.map(({ key, size }) => [key, size] as const),
         });
         const ticket: S3ArchiveTicket = {
            token,
            expiresAt: expiresAt.toISOString(),
            filename,
         };
         res.status(201).json(ticket);
      }
   )
);

// tickets outlive their request, so folders are checked again on redemption.
const readTicketInFolders = async (
   res: Response,
   token: string,
   binding: { userId: string; serverId: string; bucket: string }
) => {
   const ticket = await readArchiveTicket(token, binding);
   assertInFolders(
      getAuth(res),
      binding.bucket,
      Permission.DOWNLOAD_OBJECT,
      ticket.objectKeys
   );
   return ticket;
};

const assertZippable = (res: Response, entries: readonly ArchiveEntry[]) => {
   if (getAuth(res).serverRole === Role.OWNER) return;
   const dotted = entries.find(({ key }) => hasDotSegment(key));
   if (dotted) {
      throw new ApiHttpError(
         409,
         `This selection includes ${dotted.key}, and paths with . or .. segments can only be downloaded by the server owner. Deselect it and try again.`
      );
   }
};

const isCapacityRefusal = (error: unknown): boolean =>
   isRateLimited(error) ||
   (error instanceof ApiHttpError && error.status === 503);

const archiveHeaders = (res: Response, filename: string): void => {
   res.setHeader("Content-Type", "application/zip");
   res.setHeader("Content-Disposition", contentDispositionFilename(filename));
};

archiveRouter.head(
   `${ARCHIVE_PATH}/:token`,
   ...bucketRoute(
      Permission.DOWNLOAD_OBJECT,
      archiveDownloadParamsSchema,
      foldersCheckedInHandler,
      async (_req, res, { serverId, bucketName, token }) => {
         const ticket = await readTicketInFolders(res, token, {
            userId: getAuth(res).userId,
            serverId,
            bucket: bucketName,
         });
         archiveHeaders(res, ticket.filename);
         res.status(200).end();
      }
   )
);

archiveRouter.get(
   `${ARCHIVE_PATH}/:token`,
   archiveDownloadLimit,
   ...bucketRoute(
      Permission.DOWNLOAD_OBJECT,
      archiveDownloadParamsSchema,
      foldersCheckedInHandler,
      async (req, res, { serverId, bucketName, token }) => {
         const { userId } = getAuth(res);
         const binding = { userId, serverId, bucket: bucketName };
         const aborted = new AbortController();
         let clientGone = false;
         const onClose = (): void => {
            if (res.writableEnded) return;
            clientGone = true;
            aborted.abort();
         };
         res.on("close", onClose);
         if (res.destroyed) onClose();
         let ticketRead = false;
         try {
            const ticket = await readTicketInFolders(res, token, binding);
            ticketRead = true;
            // the slot comes first so a busy server costs a ticket read, not a listing.
            await withUploadSlot(
               req,
               res,
               {
                  userId,
                  reservation: uploadMemoryFor(env.UPLOAD_PART_BYTES),
                  pool: ARCHIVE_POOL,
                  abortController: aborted,
                  closeOnFailure: false,
               },
               async () => {
                  aborted.signal.throwIfAborted();
                  const read = await readScope(bucketName, res, aborted.signal);
                  const scope = {
                     ...read,
                     client: withoutRetries(read.client),
                     tenant: { userId, serverId },
                  };
                  const limits = archiveLimits();
                  const { entries, bytes } = await collectArchiveEntries(
                     scope,
                     ticket.objectKeys,
                     limits,
                     ticket.fileSizes,
                     ticket.manifest
                  );
                  assertZippable(res, entries);
                  aborted.signal.throwIfAborted();
                  const deadline = setTimeout(
                     () =>
                        aborted.abort(new Error("The download is too slow.")),
                     Math.min(
                        UPLOAD_SLOT_MAX_MS,
                        Math.max(
                           S3_ROUTE_TIMEOUT_MS,
                           archiveDeadlineMs(bytes, entries.length)
                        )
                     )
                  );
                  deadline.unref();
                  try {
                     archiveHeaders(res, ticket.filename);
                     await streamArchive({
                        scope,
                        entries,
                        output: res,
                        abortController: aborted,
                        maxBytes: limits.maxBytes,
                        // the record can refuse with "try again", so the ticket is spent only once it is written.
                        beforeOutput: async () => {
                           await record(res, {
                              action: "object.archive",
                              bucket: bucketName,
                              target: ticket.target,
                              detail: {
                                 objects: entries.length,
                                 estimatedBytes: bytes,
                                 outcome: "attempt",
                              },
                           });
                           await takeArchiveTicket(token, binding);
                        },
                     });
                  } catch (error) {
                     logger.warn("Zip archive failed", {
                        objects: entries.length,
                        error: describeError(error),
                     });
                     if (!res.headersSent) {
                        res.removeHeader("Content-Type");
                        res.removeHeader("Content-Disposition");
                        if (error instanceof UploadIdleError)
                           throw new ApiHttpError(
                              504,
                              "Storage did not answer in time. Try again."
                           );
                        throw error;
                     }
                     res.destroy();
                  } finally {
                     clearTimeout(deadline);
                  }
               }
            );
         } catch (error) {
            if (ticketRead && !clientGone && !isCapacityRefusal(error))
               await failArchiveTicket(token, binding).catch(
                  (failure: unknown) => {
                     logger.warn("Could not count a failed zip download", {
                        error: describeError(failure),
                     });
                  }
               );
            throw error;
         } finally {
            res.off("close", onClose);
         }
      }
   )
);

export { archiveRouter };
