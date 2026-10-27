import {
   disconnectSignal,
   noContent,
   requestId,
   sendPartialResult,
} from "@/lib/http";
import { record, recordMany } from "@/lib/middleware/audit-record";
import { bucketRoute } from "@/lib/middleware/route";
import { copyObject } from "@/lib/s3/copy";
import { headReviewed } from "@/lib/s3/object-metadata";
import {
   PartialRenameError,
   moveObjects,
   partialCopies,
   renameObject,
   unconfirmedCopies,
} from "@/lib/s3/rename";
import { Permission } from "@s3-viewer/permissions";
import {
   OBJECT_MUTATION_PATH,
   copyObjectBodySchema,
   moveObjectsBodySchema,
   parentPrefix,
   renameObjectBodySchema,
   type AuditDetail,
   type AuditEntry,
   type S3MoveResult,
   type S3ObjectUploaded,
} from "@s3-viewer/shared";
import { Router } from "express";
import {
   awaitStorage,
   copyScope,
   mutationScope,
   recordedIfUnconfirmed,
} from "./scope";

const objectMovesRouter = Router({ mergeParams: true });

objectMovesRouter.post(
   `${OBJECT_MUTATION_PATH}/rename`,
   ...bucketRoute(
      Permission.DELETE_OBJECT,
      renameObjectBodySchema,
      ({ objectKey, newObjectKey }) => [objectKey, newObjectKey],
      async (_req, res, input) => {
         const { bucketName, objectKey, newObjectKey, expectedETag } = input;
         const { scope, provider } = await mutationScope(bucketName, res);
         const source = await headReviewed(scope, objectKey, expectedETag);
         const copied: AuditEntry = {
            action: "object.copy",
            bucket: bucketName,
            target: objectKey,
            detail: { to: newObjectKey },
         };
         try {
            await recordedIfUnconfirmed(res, copied, () =>
               renameObject(copyScope(scope, res, source), provider, {
                  objectKey,
                  newObjectKey,
                  source,
                  sourceETag: expectedETag,
               })
            );
         } catch (error) {
            if (error instanceof PartialRenameError) await record(res, copied);
            throw error;
         }
         await record(res, {
            action:
               parentPrefix(objectKey) === parentPrefix(newObjectKey)
                  ? "object.rename"
                  : "object.move",
            bucket: bucketName,
            target: objectKey,
            detail: { to: newObjectKey },
         });
         noContent(res);
      }
   )
);

objectMovesRouter.post(
   `${OBJECT_MUTATION_PATH}/move`,
   ...bucketRoute(
      Permission.DELETE_OBJECT,
      moveObjectsBodySchema,
      ({ objects }) => objects.flatMap(({ key, newKey }) => [key, newKey]),
      async (_req, res, input) => {
         const { bucketName, objects } = input;
         const { scope, provider } = await mutationScope(bucketName, res);
         awaitStorage(res);
         const result = await moveObjects(
            { ...scope, signal: disconnectSignal(res) },
            provider,
            objects
         );
         const detail = {
            batch: requestId(res),
            count: result.moved.length,
         };
         const byKey = new Map(objects.map(({ key, newKey }) => [key, newKey]));
         const entriesFor = (
            action: "object.move" | "object.copy",
            keys: readonly string[],
            extra: AuditDetail = {}
         ): AuditEntry[] =>
            keys.map((key) => ({
               action,
               bucket: bucketName,
               target: key,
               detail: { ...detail, to: byKey.get(key) ?? null, ...extra },
            }));
         await recordMany(res, [
            ...entriesFor("object.move", result.moved),
            ...entriesFor("object.copy", partialCopies(result)),
            ...entriesFor("object.copy", unconfirmedCopies(result), {
               confirmed: false,
            }),
         ]);
         const moved: S3MoveResult = result;
         sendPartialResult(res, moved);
      }
   )
);

objectMovesRouter.post(
   `${OBJECT_MUTATION_PATH}/copy`,
   ...bucketRoute(
      Permission.UPLOAD_OBJECT,
      copyObjectBodySchema,
      ({ objectKey, newObjectKey }) => [objectKey, newObjectKey],
      async (_req, res, input) => {
         const {
            bucketName,
            objectKey,
            newObjectKey,
            expectedETag,
            expectedDestinationETag,
         } = input;
         const { scope, provider } = await mutationScope(bucketName, res);
         const source = await headReviewed(scope, objectKey, expectedETag);
         const replaced = expectedDestinationETag !== undefined && {
            replaced: true,
         };
         const { eTag, size } = await recordedIfUnconfirmed(
            res,
            {
               action: "object.copy",
               bucket: bucketName,
               target: objectKey,
               detail: { to: newObjectKey, ...replaced },
            },
            () =>
               copyObject(copyScope(scope, res, source), provider, {
                  sourceKey: objectKey,
                  destinationKey: newObjectKey,
                  source,
                  sourceETag: expectedETag,
                  ...(expectedDestinationETag !== undefined && {
                     destinationETag: expectedDestinationETag,
                  }),
               })
         );
         await record(res, {
            action: "object.copy",
            bucket: bucketName,
            target: objectKey,
            detail: { size, to: newObjectKey, ...replaced },
         });
         const copied: S3ObjectUploaded = { key: newObjectKey, size, eTag };
         res.status(201).json(copied);
      }
   )
);

export { objectMovesRouter };
