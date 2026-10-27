import { record } from "@/lib/middleware/audit-record";
import { strictOriginCheck } from "@/lib/middleware/origin";
import { existsLimit } from "@/lib/middleware/rate-limit";
import {
   bucketRoute,
   byObjectKey,
   foldersCheckedInHandler,
} from "@/lib/middleware/route";
import { assertListablePrefix, getAuth } from "@/lib/middleware/authorize";
import { whichExistInFolders } from "@/lib/s3/existence";
import { headObject, toSettings } from "@/lib/s3/head";
import {
   contentDispositionFilename,
   inlineContentType,
   inlineDisposition,
} from "@/lib/s3/keys";
import { listKeysPage, listPage, pathToFoldersPage } from "@/lib/s3/listing";
import { createFolder } from "@/lib/s3/copy";
import { presignedUrl } from "@/lib/s3/presign";
import {
   GetObjectCommand,
   type GetObjectCommandInput,
   type HeadObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { Permission } from "@s3-viewer/permissions";
import {
   OBJECT_MUTATION_PATH,
   createFolderBodySchema,
   keysQuerySchema,
   listObjectsQuerySchema,
   objectKeysBodySchema,
   objectScope,
   isPrefixInFolderScope,
   type AuditDetail,
   type AuditEntry,
   type Role,
} from "@s3-viewer/shared";
import { Router, type RequestHandler } from "express";
import { objectDeleteRouter } from "./object-delete";
import { objectMovesRouter } from "./object-moves";
import { objectUploadRouter } from "./object-upload";
import { mutationScope, readScope } from "./scope";

const objectsRouter = Router({ mergeParams: true });

objectsRouter.use(objectUploadRouter, objectMovesRouter, objectDeleteRouter);

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
