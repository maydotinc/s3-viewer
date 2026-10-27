import { uploadMemoryFor } from "@/lib/constants";
import { env } from "@/lib/env";
import { ApiHttpError } from "@/lib/http";
import { record } from "@/lib/middleware/audit-record";
import { assertInFolders, getAuth } from "@/lib/middleware/authorize";
import {
   archiveDownloadLimit,
   archiveLimit,
} from "@/lib/middleware/rate-limit";
import { bucketRoute, foldersCheckedInHandler } from "@/lib/middleware/route";
import { withUploadSlot } from "@/lib/middleware/upload-slot";
import { readArchiveTicket } from "@/lib/s3/archive/ticket";
import { contentDispositionFilename } from "@/lib/s3/keys";
import { withoutRetries } from "@/lib/s3/no-retry";
import { UploadIdleError } from "@/lib/s3/progress-floor";
import { ARCHIVE_POOL } from "@/lib/s3/upload-budget";
import {
   countFailedDownload,
   downloadArchive,
   issueArchiveTicket,
} from "@/lib/services/archive";
import { Permission } from "@s3-viewer/permissions";
import {
   OBJECT_MUTATION_PATH,
   archiveDownloadParamsSchema,
   archiveRequestBodySchema,
} from "@s3-viewer/shared";
import { Router, type Response } from "express";
import { readScope } from "./scope";

const archiveRouter = Router({ mergeParams: true });
const ARCHIVE_PATH = `${OBJECT_MUTATION_PATH}/archive`;

archiveRouter.post(
   ARCHIVE_PATH,
   archiveLimit,
   ...bucketRoute(
      Permission.DOWNLOAD_OBJECT,
      archiveRequestBodySchema,
      ({ objectKeys }) => objectKeys,
      async (_req, res, input) => {
         const { serverId, bucketName, objectKeys } = input;
         const { userId, serverRole } = getAuth(res);
         const scope = await readScope(bucketName, res);
         const ticket = await issueArchiveTicket(
            { ...scope, tenant: { userId, serverId } },
            objectKeys,
            serverRole
         );
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
         const { userId, serverRole } = getAuth(res);
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
                  await downloadArchive({
                     scope: {
                        ...read,
                        client: withoutRetries(read.client),
                        tenant: { userId, serverId },
                     },
                     ticket,
                     token,
                     binding,
                     serverRole,
                     abortController: aborted,
                     output: res,
                     recordAttempt: (detail) =>
                        record(res, {
                           action: "object.archive",
                           bucket: bucketName,
                           target: ticket.target,
                           detail: { ...detail, outcome: "attempt" },
                        }),
                     onStart: () => archiveHeaders(res, ticket.filename),
                     onFailure: (error) => {
                        if (res.headersSent) {
                           res.destroy();
                           return;
                        }
                        res.removeHeader("Content-Type");
                        res.removeHeader("Content-Disposition");
                        if (error instanceof UploadIdleError)
                           throw new ApiHttpError(
                              504,
                              "Storage did not answer in time. Try again."
                           );
                        throw error;
                     },
                  });
               }
            );
         } catch (error) {
            if (ticketRead && !clientGone)
               await countFailedDownload(token, binding, error);
            throw error;
         } finally {
            res.off("close", onClose);
         }
      }
   )
);

export { archiveRouter };
