import { S3_ROUTE_TIMEOUT_MS } from "@/lib/constants";
import { ApiHttpError, requestSignal } from "@/lib/http";
import { record } from "@/lib/middleware/audit-record";
import { strictOriginCheck } from "@/lib/middleware/origin";
import { bucketRoute, byObjectKey } from "@/lib/middleware/route";
import { getAuth } from "@/lib/middleware/authorize";
import { readBudget, type ReadReservation } from "@/lib/s3/read-budget";
import { createBufferedBody } from "@/lib/s3/buffered-body";
import { requireBody, throwHttpError } from "@/lib/s3/errors";
import { inlineContentType, inlineDisposition } from "@/lib/s3/keys";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { Permission } from "@s3-viewer/permissions";
import {
   DEFAULT_CONTENT_TYPE,
   MAX_EDIT_BYTES,
   OBJECT_MUTATION_PATH,
   objectContentQuerySchema,
} from "@s3-viewer/types";
import { Router } from "express";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { readScope } from "./scope";

const contentRouter = Router({ mergeParams: true });

const editorSizeError = () =>
   new ApiHttpError(
      413,
      `Files over ${MAX_EDIT_BYTES} bytes can't be edited here.`
   );

const readEditorContent = (
   body: Readable,
   contentLength: number | undefined,
   signal: AbortSignal,
   reservation: ReadReservation
): Promise<Buffer> =>
   pipeline(
      body,
      async (source: AsyncIterable<Buffer | Uint8Array | string>) => {
         // validate inside the pipeline so rejection also closes the GET body.
         if (contentLength !== undefined) {
            if (contentLength > MAX_EDIT_BYTES) throw editorSizeError();
            if (!Number.isSafeInteger(contentLength) || contentLength < 0)
               throw new ApiHttpError(
                  502,
                  "Storage returned an invalid body length."
               );
         }
         const buffer = createBufferedBody(reservation);
         let size = 0;
         for await (const chunk of source) {
            size += Buffer.byteLength(chunk);
            if (size > MAX_EDIT_BYTES) throw editorSizeError();
            buffer.append(
               typeof chunk === "string" ? Buffer.from(chunk) : chunk
            );
         }
         return buffer.toBuffer();
      },
      { signal }
   );

contentRouter.get(
   `${OBJECT_MUTATION_PATH}/content`,
   strictOriginCheck,
   ...bucketRoute(
      Permission.DOWNLOAD_OBJECT,
      objectContentQuerySchema,
      byObjectKey,
      async (_req, res, input) => {
         const { bucketName, objectKey } = input;
         const auth = getAuth(res);
         const signal = requestSignal(res, S3_ROUTE_TIMEOUT_MS);
         const reservation = readBudget.acquire({
            serverId: auth.serverId,
            userId: auth.userId,
         });
         try {
            const { client } = await readScope(bucketName, res, signal);
            const object = await client
               .send(
                  new GetObjectCommand({ Bucket: bucketName, Key: objectKey }),
                  { abortSignal: signal }
               )
               .catch(throwHttpError);
            const content = await readEditorContent(
               requireBody(object.Body),
               object.ContentLength,
               signal,
               reservation
            );
            // the bytes stay held until the response is sent; only the storage read is over.
            reservation.finishRead();
            const contentType = object.ContentType ?? DEFAULT_CONTENT_TYPE;
            await record(res, {
               action: "object.view",
               bucket: bucketName,
               target: objectKey,
               detail: { size: content.length, contentType },
            });
            res.setHeader("Content-Type", inlineContentType(contentType));
            res.setHeader(
               "Content-Disposition",
               inlineDisposition(contentType)
            );
            if (object.ETag) res.setHeader("ETag", object.ETag);
            // a compressing proxy would rewrite the ETag the client compares and sends back as If-Match
            res.setHeader("Cache-Control", "private, no-store, no-transform");
            res.setHeader("Content-Length", String(content.length));
            await pipeline(Readable.from([content]), res, { signal });
         } finally {
            reservation.release();
         }
      }
   )
);

export { contentRouter };
