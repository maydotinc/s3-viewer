import { env } from "@/lib/env";
import {
   disconnectSignal,
   noContent,
   requestId,
   sendPartialResult,
} from "@/lib/http";
import { record, recordMany } from "@/lib/middleware/audit-record";
import { strictOriginCheck } from "@/lib/middleware/origin";
import { existsLimit } from "@/lib/middleware/rate-limit";
import {
   bucketRoute,
   byObjectKey,
   foldersCheckedInHandler,
} from "@/lib/middleware/route";
import { assertListablePrefix, getAuth } from "@/lib/middleware/authorize";
import { withUploadSlot } from "@/lib/middleware/upload-slot";
import { isUnconfirmed } from "@/lib/s3/checked-delete";
import { deleteKeys } from "@/lib/s3/delete";
import { whichExistInFolders } from "@/lib/s3/existence";
import { headObject, toSettings } from "@/lib/s3/head";
import {
   contentDispositionFilename,
   inlineContentType,
   inlineDisposition,
} from "@/lib/s3/keys";
import { listKeysPage, listPage, pathToFoldersPage } from "@/lib/s3/listing";
import { copyObject, createFolder } from "@/lib/s3/copy";
import { headReviewed } from "@/lib/s3/object-metadata";
import {
   PartialRenameError,
   moveObjects,
   partialCopies,
   renameObject,
} from "@/lib/s3/rename";
import { presignedUrl } from "@/lib/s3/presign";
import {
   declaredLength,
   plannedPartSize,
   streamedUploadCap,
   streamUpload,
} from "@/lib/s3/upload";
import { uploadMemoryFor } from "@/lib/constants";
import {
   GetObjectCommand,
   type GetObjectCommandInput,
   type HeadObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { Permission } from "@s3-viewer/permissions";
import {
   OBJECT_MUTATION_PATH,
   copyObjectBodySchema,
   createFolderBodySchema,
   deleteObjectsBodySchema,
   moveObjectsBodySchema,
   keysQuerySchema,
   listObjectsQuerySchema,
   objectKeysBodySchema,
   objectScope,
   isPrefixInFolderScope,
   parentPrefix,
   putObjectQuerySchema,
   renameObjectBodySchema,
   type AuditDetail,
   type AuditEntry,
   type Role,
   type S3DeleteResult,
   type S3MoveResult,
   type S3ObjectUploaded,
} from "@s3-viewer/types";
import { Router, type RequestHandler } from "express";
import { awaitStorage, copyScope, mutationScope, readScope } from "./scope";

const objectsRouter = Router({ mergeParams: true });

// the prefix is whatever the caller sent, and its head already says which tree was browsed.
const MAX_LIST_TARGET = 256;
const listTarget = (prefix: string): string =>
   prefix.length > MAX_LIST_TARGET
      ? `${prefix.slice(0, MAX_LIST_TARGET)}…`
      : prefix || "/";

type PresignedGet<Body extends object> = {
   action: AuditEntry["action"];
   view: (
      head: HeadObjectCommandOutput,
      objectKey: string,
      bucketRole: Role | null
   ) => {
      params: Omit<GetObjectCommandInput, "Bucket" | "Key">;
      detail?: AuditDetail;
      body?: Body;
   };
};

// HEAD first so a missing object is a 404 rather than a signed link that fails later.
const presignedGetRoute = <Body extends object>({
   action,
   view,
}: PresignedGet<Body>): RequestHandler[] => [
   strictOriginCheck,
   ...bucketRoute(
      Permission.DOWNLOAD_OBJECT,
      objectScope,
      byObjectKey,
      async (_req, res, input) => {
         const { bucketName, objectKey } = input;
         const scope = await readScope(bucketName, res);
         const { params, detail, body } = view(
            await headObject(scope, objectKey),
            objectKey,
            getAuth(res).bucketRole
         );
         const url = await presignedUrl(
            scope.client,
            new GetObjectCommand({
               Bucket: bucketName,
               Key: objectKey,
               ...params,
            })
         );
         await record(res, {
            action,
            bucket: bucketName,
            target: objectKey,
            ...(detail && { detail }),
         });
         res.json({ ...url, ...body });
      }
   ),
];

objectsRouter.get(
   "/",
   strictOriginCheck,
   ...bucketRoute(
      Permission.LIST_OBJECTS,
      listObjectsQuerySchema,
      foldersCheckedInHandler,
      async (_req, res, input) => {
         const { bucketName, prefix, continuationToken, blockSize } = input;
         const auth = getAuth(res);
         const { folders } = auth;
         assertListablePrefix(
            auth,
            bucketName,
            Permission.LIST_OBJECTS,
            prefix
         );
         const page =
            folders !== null && !isPrefixInFolderScope(folders, prefix)
               ? pathToFoldersPage(folders, prefix)
               : await listPage({
                    ...(await readScope(bucketName, res)),
                    prefix,
                    continuationToken,
                    blockSize,
                 });
         if (!continuationToken) {
            await record(res, {
               action: "object.list",
               bucket: bucketName,
               target: listTarget(prefix),
            });
         }
         res.json(page);
      }
   )
);

objectsRouter.post(
   "/exists",
   existsLimit,
   ...bucketRoute(
      Permission.UPLOAD_OBJECT,
      objectKeysBodySchema,
      ({ objectKeys }) => objectKeys,
      async (_req, res, input) => {
         const { bucketName, objectKeys } = input;
         const scope = await readScope(bucketName, res);
         res.json(
            await whichExistInFolders(scope, getAuth(res).folders, objectKeys)
         );
      }
   )
);

objectsRouter.get(
   "/download-url",
   ...presignedGetRoute({
      action: "object.download",
      view: (_head, objectKey) => ({
         params: {
            ResponseContentDisposition: contentDispositionFilename(objectKey),
         },
      }),
   })
);

objectsRouter.get(
   "/preview-url",
   ...presignedGetRoute({
      action: "object.view",
      view: (head, _objectKey, bucketRole) => {
         const metadata = toSettings(head, bucketRole);
         return {
            params: {
               ResponseContentType: inlineContentType(metadata.contentType),
               ResponseContentDisposition: inlineDisposition(
                  metadata.contentType
               ),
            },
            detail: {
               size: metadata.contentLength,
               contentType: metadata.contentType,
            },
            body: metadata,
         };
      },
   })
);

objectsRouter.put(
   `${OBJECT_MUTATION_PATH}/upload`,
   ...bucketRoute(
      Permission.UPLOAD_OBJECT,
      putObjectQuerySchema,
      byObjectKey,
      async (req, res, input) => {
         const { bucketName, objectKey, contentType, expectedETag } = input;
         const { userId } = getAuth(res);
         const contentLength = declaredLength(req.headers["content-length"]);
         const partSize = plannedPartSize(contentLength);
         await withUploadSlot(
            req,
            res,
            {
               userId,
               reservation: uploadMemoryFor(partSize),
               bytes: contentLength,
               bucket: bucketName,
            },
            async (abortController, client) => {
               const { size, eTag } = await streamUpload({
                  client,
                  bucket: bucketName,
                  key: objectKey,
                  contentType,
                  expectedETag,
                  body: req,
                  contentLength,
                  partSize,
                  maxBytes: streamedUploadCap(partSize),
                  abortController,
                  idleTimeoutMs: env.UPLOAD_IDLE_TIMEOUT_MS,
               });
               const uploaded: S3ObjectUploaded = {
                  key: objectKey,
                  size,
                  eTag,
               };
               await record(res, {
                  action: "object.upload",
                  bucket: bucketName,
                  target: objectKey,
                  detail: {
                     size,
                     contentType,
                     replaced: Boolean(expectedETag),
                  },
               });
               res.status(201).json(uploaded);
            }
         );
      }
   )
);

objectsRouter.delete(
   OBJECT_MUTATION_PATH,
   ...bucketRoute(
      Permission.DELETE_OBJECT,
      deleteObjectsBodySchema,
      ({ objects }) => objects.map(({ key }) => key),
      async (_req, res, input) => {
         const { bucketName, objects } = input;
         const scope = await readScope(bucketName, res);
         const { deleted, alreadyGone, failed } = await deleteKeys(
            scope,
            objects
         );
         const batch = requestId(res);
         await recordMany(res, [
            ...deleted.map(
               (key): AuditEntry => ({
                  action: "object.delete",
                  bucket: bucketName,
                  target: key,
                  detail: { batch, count: deleted.length },
               })
            ),
            ...failed.filter(isUnconfirmed).map(
               ({ key }): AuditEntry => ({
                  action: "object.delete",
                  bucket: bucketName,
                  target: key,
                  detail: { batch, confirmed: false },
               })
            ),
         ]);
         const result: S3DeleteResult = {
            deleted: [...deleted, ...alreadyGone],
            failed,
         };
         sendPartialResult(res, result);
      }
   )
);

objectsRouter.get(
   "/keys",
   strictOriginCheck,
   ...bucketRoute(
      Permission.LIST_OBJECTS,
      keysQuerySchema,
      ({ prefix }) => [prefix],
      async (_req, res, input) => {
         const { bucketName, prefix, continuationToken } = input;
         const scope = await readScope(bucketName, res);
         const page = await listKeysPage(scope, prefix, continuationToken);
         if (!continuationToken) {
            await record(res, {
               action: "object.list",
               bucket: bucketName,
               target: listTarget(prefix),
               detail: { recursive: true },
            });
         }
         res.json(page);
      }
   )
);

objectsRouter.post(
   `${OBJECT_MUTATION_PATH}/rename`,
   ...bucketRoute(
      Permission.DELETE_OBJECT,
      renameObjectBodySchema,
      ({ objectKey, newObjectKey }) => [objectKey, newObjectKey],
      async (_req, res, input) => {
         const { bucketName, objectKey, newObjectKey, expectedETag } = input;
         const { scope, provider } = await mutationScope(bucketName, res);
         const source = await headReviewed(scope, objectKey, expectedETag);
         try {
            await renameObject(copyScope(scope, res, source), provider, {
               objectKey,
               newObjectKey,
               source,
               sourceETag: expectedETag,
            });
         } catch (error) {
            if (error instanceof PartialRenameError)
               await record(res, {
                  action: "object.copy",
                  bucket: bucketName,
                  target: objectKey,
                  detail: { to: newObjectKey },
               });
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

objectsRouter.post(
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
            keys: readonly string[]
         ): AuditEntry[] =>
            keys.map((key) => ({
               action,
               bucket: bucketName,
               target: key,
               detail: { ...detail, to: byKey.get(key) ?? null },
            }));
         await recordMany(res, [
            ...entriesFor("object.move", result.moved),
            ...entriesFor("object.copy", partialCopies(result)),
         ]);
         const moved: S3MoveResult = result;
         sendPartialResult(res, moved);
      }
   )
);

objectsRouter.post(
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
         const { eTag, size } = await copyObject(
            copyScope(scope, res, source),
            provider,
            {
               sourceKey: objectKey,
               destinationKey: newObjectKey,
               source,
               sourceETag: expectedETag,
               ...(expectedDestinationETag !== undefined && {
                  destinationETag: expectedDestinationETag,
               }),
            }
         );
         await record(res, {
            action: "object.copy",
            bucket: bucketName,
            target: objectKey,
            detail: {
               size,
               to: newObjectKey,
               ...(expectedDestinationETag !== undefined && {
                  replaced: true,
               }),
            },
         });
         const copied: S3ObjectUploaded = { key: newObjectKey, size, eTag };
         res.status(201).json(copied);
      }
   )
);

objectsRouter.post(
   `${OBJECT_MUTATION_PATH}/folders`,
   ...bucketRoute(
      Permission.UPLOAD_OBJECT,
      createFolderBodySchema,
      ({ folderKey }) => [folderKey],
      async (_req, res, input) => {
         const { bucketName, folderKey } = input;
         const { scope, provider } = await mutationScope(bucketName, res);
         await createFolder(scope, provider, folderKey);
         await record(res, {
            action: "folder.create",
            bucket: bucketName,
            target: folderKey,
         });
         res.status(201).json({ key: folderKey });
      }
   )
);

export { objectsRouter };
