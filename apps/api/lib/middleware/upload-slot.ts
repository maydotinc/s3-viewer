import {
   ApiHttpError,
   isRateLimited,
   retryReason,
   watchDisconnect,
} from "@/lib/http";
import { getS3Client } from "@/lib/s3/client-cache";
import { throwHttpError, uploadTooLarge } from "@/lib/s3/errors";
import {
   SlotExpiredError,
   StorageStalledError,
   UploadIdleError,
} from "@/lib/s3/progress-floor";
import { isUploadTooLargeError } from "@/lib/s3/stream-upload";
import {
   slotLifetimeMs,
   uploadBudget,
   type Pool,
} from "@/lib/s3/upload-budget";
import type { ErrorCode } from "@s3-viewer/types";
import type { S3Client } from "@aws-sdk/client-s3";
import type { Request, Response } from "express";
import { ipKeyGenerator } from "express-rate-limit";
import { getAuth } from "./authorize";
import { allowStreamingBody } from "./request-body";

type UploadSlotOptions = {
   userId: string;
   reservation: number;
   // declared body size; the slot's lifetime scales with it.
   bytes?: number;
   ip?: string;
   // defaults to the server the authorize gate admitted the request for.
   serverId?: string;
   pool?: Pool;
   admissionErrorCode?: ErrorCode;
   abortController?: AbortController;
   closeOnFailure?: boolean;
};

const acquireSlot = (
   res: Response,
   {
      userId,
      reservation,
      pool,
      ip,
      serverId,
      admissionErrorCode,
   }: UploadSlotOptions
): (() => void) => {
   try {
      return uploadBudget.acquire(userId, reservation, pool, ip, serverId);
   } catch (error) {
      res.setHeader("Connection", "close");
      if (isRateLimited(error)) {
         res.setHeader("Retry-After", "5");
         if (admissionErrorCode)
            throw new ApiHttpError(
               error.status,
               error.message,
               admissionErrorCode
            );
      }
      throw error;
   }
};

function withUploadSlot<T>(
   req: Request,
   res: Response,
   options: UploadSlotOptions & { bucket: string },
   run: (abortController: AbortController, client: S3Client) => Promise<T>
): Promise<T>;
function withUploadSlot<T>(
   req: Request,
   res: Response,
   options: UploadSlotOptions,
   run: (abortController: AbortController) => Promise<T>
): Promise<T>;
async function withUploadSlot<T>(
   req: Request,
   res: Response,
   options: UploadSlotOptions & { bucket?: string },
   run: (abortController: AbortController, client: S3Client) => Promise<T>
): Promise<T> {
   const abortController = options.abortController ?? new AbortController();
   const stopWatching = watchDisconnect(res, abortController, req);
   let release: (() => void) | undefined;
   let expiry: ReturnType<typeof setTimeout> | undefined;
   try {
      abortController.signal.throwIfAborted();
      release = acquireSlot(res, {
         ...options,
         ip: options.ip ?? ipKeyGenerator(req.ip ?? ""),
         serverId: options.serverId ?? res.locals.auth?.serverId,
      });
      expiry = setTimeout(
         () => abortController.abort(new SlotExpiredError()),
         slotLifetimeMs(options.bytes)
      );
      expiry.unref();
      // socket timeouts would also kill healthy S3 backpressure and completion.
      req.setTimeout(0);
      allowStreamingBody(req);
      const client =
         options.bucket === undefined
            ? undefined
            : await getS3Client(
                 getAuth(res),
                 options.bucket,
                 abortController.signal
              );
      return await run(abortController, client as S3Client);
   } catch (error) {
      if (!res.headersSent && options.closeOnFailure !== false)
         res.setHeader("Connection", "close");
      if (isUploadTooLargeError(error)) throw uploadTooLarge(error.limit);
      const { reason } = abortController.signal;
      // storage clients surface their own abort error, not the reason we aborted with.
      if (reason instanceof SlotExpiredError)
         throw new ApiHttpError(408, reason.message);
      if (error instanceof UploadIdleError)
         throw new ApiHttpError(408, error.message);
      if (error instanceof StorageStalledError)
         throw new ApiHttpError(504, error.message);
      if (retryReason(error) !== null) throw error;
      return throwHttpError(error);
   } finally {
      clearTimeout(expiry);
      stopWatching();
      release?.();
   }
}

export { withUploadSlot };
