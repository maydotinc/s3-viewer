import { requestId, sendPartialResult } from "@/lib/http";
import { recordMany } from "@/lib/middleware/audit-record";
import { bucketRoute } from "@/lib/middleware/route";
import { isUnconfirmed } from "@/lib/s3/checked-delete";
import { deleteKeys } from "@/lib/s3/delete";
import { Permission } from "@s3-viewer/permissions";
import {
   OBJECT_MUTATION_PATH,
   deleteObjectsBodySchema,
   type AuditEntry,
   type S3DeleteResult,
} from "@s3-viewer/shared";
import { Router } from "express";
import { readScope } from "./scope";

const objectDeleteRouter = Router({ mergeParams: true });

objectDeleteRouter.delete(
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

export { objectDeleteRouter };
