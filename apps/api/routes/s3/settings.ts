import { record } from "@/lib/middleware/audit-record";
import { getAuth } from "@/lib/middleware/authorize";
import { bucketRoute, byObjectKey } from "@/lib/middleware/route";
import { copyObject, type CopySettings } from "@/lib/s3/copy";
import { headObject, toSettings } from "@/lib/s3/head";
import { headReviewed } from "@/lib/s3/object-metadata";
import { Permission } from "@s3-viewer/permissions";
import {
   OBJECT_MUTATION_PATH,
   objectSettingsQuerySchema,
   updateObjectSettingsBodySchema,
   type UpdateObjectSettingsInput,
} from "@s3-viewer/types";
import { Router } from "express";
import { copyScope, mutationScope, readScope } from "./scope";

const settingsRouter = Router({ mergeParams: true });
const SETTINGS_PATH = `${OBJECT_MUTATION_PATH}/settings`;

// MetadataDirective REPLACE removes omitted headers, so empty form values clear them.
const settingsAttributes = ({
   contentType,
   cacheControl,
   contentDisposition,
   contentEncoding,
   contentLanguage,
   expires,
   metadata,
}: UpdateObjectSettingsInput): CopySettings => ({
   ContentType: contentType,
   CacheControl: cacheControl || undefined,
   ContentDisposition: contentDisposition || undefined,
   ContentEncoding: contentEncoding || undefined,
   ContentLanguage: contentLanguage || undefined,
   Expires: expires ? new Date(expires) : undefined,
   Metadata: metadata,
});

settingsRouter.get(
   SETTINGS_PATH,
   ...bucketRoute(
      Permission.DOWNLOAD_OBJECT,
      objectSettingsQuerySchema,
      byObjectKey,
      async (_req, res, input) => {
         const { bucketName, objectKey } = input;
         const scope = await readScope(bucketName, res);
         res.json(
            toSettings(
               await headObject(scope, objectKey),
               getAuth(res).bucketRole
            )
         );
      }
   )
);

settingsRouter.patch(
   SETTINGS_PATH,
   ...bucketRoute(
      Permission.UPLOAD_OBJECT,
      updateObjectSettingsBodySchema,
      byObjectKey,
      async (_req, res, settings) => {
         const { bucketName, objectKey, expectedETag, contentType } = settings;
         const { scope, provider } = await mutationScope(bucketName, res);
         const source = await headReviewed(scope, objectKey, expectedETag);
         const attributes = settingsAttributes(settings);
         const { eTag, size } = await copyObject(
            copyScope(scope, res, source),
            provider,
            {
               sourceKey: objectKey,
               destinationKey: objectKey,
               source,
               sourceETag: expectedETag,
               settings: attributes,
            }
         );
         await record(res, {
            action: "object.settings",
            bucket: bucketName,
            target: objectKey,
            detail: { contentType },
         });
         res.json(
            toSettings(
               {
                  ...source,
                  ...attributes,
                  ContentLength: size,
                  ETag: eTag ?? undefined,
                  LastModified: undefined,
                  VersionId: undefined,
               },
               getAuth(res).bucketRole
            )
         );
      }
   )
);

export { settingsRouter };
