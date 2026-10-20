import { ApiHttpError, rethrowDbError, serverNotFound } from "@/lib/http";
import { getAuth, requireUser } from "@/lib/middleware/authorize";
import { requireFreshSession } from "@/lib/middleware/fresh-session";
import { connectLimit } from "@/lib/middleware/rate-limit";
import { serverRoute } from "@/lib/middleware/route";
import {
   getS3ClientFromCredentials,
   invalidateS3Client,
} from "@/lib/s3/client-cache";
import { assertCredentialsWork } from "@/lib/s3/probe";
import { recordAlways } from "@/lib/middleware/audit-record";
import {
   openCredentials,
   serverInfoSelect,
   toServerInfo,
} from "@/lib/services/servers";
import { storageCapabilities } from "@/lib/services/storage-capabilities";
import { decryptCredentials } from "@/lib/utils/encryption";
import { prisma } from "@s3-viewer/db";
import { Permission } from "@s3-viewer/permissions";
import {
   updateCredentialsSchema,
   type AuditDetail,
   type ServerCredentials,
   type UpdateCredentialsInput,
} from "@s3-viewer/types";
import { Router, type Request, type Response } from "express";

const credentialsRouter: Router = Router();

const readStored = (
   blob: string,
   ownerId: string
): ServerCredentials | null => {
   try {
      return decryptCredentials(blob, ownerId);
   } catch {
      return null;
   }
};

const keySuffix = (accessKey: string): string => {
   const length = Math.min(4, Math.floor(accessKey.length / 4));
   return length > 0 ? accessKey.slice(-length) : "";
};

// unreadable old credentials count as changed; the secret and full key id never reach the log.
const changeDetail = (
   previous: ServerCredentials | null,
   next: ServerCredentials
): AuditDetail => ({
   endpointHost: new URL(next.endpoint).host,
   accessKeyIdSuffix: keySuffix(next.accessKey),
   region: next.region,
   endpointChanged: previous?.endpoint !== next.endpoint,
   accountChanged: previous?.accessKey !== next.accessKey,
});

const updateCredentials = async (
   req: Request,
   res: Response,
   input: UpdateCredentialsInput
) => {
   requireUser(req);
   const { serverId, encryptedCredentials } = input;
   const {
      userId,
      serverRole,
      bucketScope,
      credentials: stored,
   } = getAuth(res);
   if (stored?.ownerId !== userId) {
      throw new ApiHttpError(403, "Only the owner can replace credentials");
   }
   requireFreshSession(req, "replacing credentials");
   const { credentials, provider } = await openCredentials(
      encryptedCredentials,
      userId
   );
   const previous = readStored(stored.credentials, stored.ownerId);
   await assertCredentialsWork(
      getS3ClientFromCredentials(credentials, provider, serverId),
      bucketScope.allowedBuckets,
      "Credential update"
   );

   const server = await prisma.server
      .update({
         where: { id: serverId },
         data: {
            credentials: encryptedCredentials,
            provider,
            capabilities: storageCapabilities(provider, credentials.endpoint),
         },
         select: serverInfoSelect,
      })
      .catch((err: unknown) =>
         rethrowDbError(err, {
            missing: serverNotFound(),
         })
      );
   invalidateS3Client(serverId);
   await recordAlways(res, {
      action: "credentials.update",
      detail: changeDetail(previous, credentials),
   });
   res.json({ server: toServerInfo(server, serverRole) });
};

credentialsRouter.patch(
   "/:serverId/credentials",
   connectLimit,
   ...serverRoute(
      Permission.UPDATE_CREDENTIALS,
      updateCredentialsSchema,
      updateCredentials
   )
);

export { credentialsRouter };
