import { SERVER_NOT_FOUND } from "@/lib/constants";
import { ApiHttpError } from "@/lib/http";
import { getAuth } from "@/lib/middleware/authorize";
import { connectLimit } from "@/lib/middleware/rate-limit";
import { serverRoute } from "@/lib/middleware/route";
import { input } from "@/lib/middleware/validate";
import {
   getS3ClientFromCredentials,
   invalidateS3Client,
} from "@/lib/s3/client-cache";
import { assertCredentialsWork } from "@/lib/s3/probe";
import { recordAudit } from "@/lib/services/audit";
import {
   isMissingRow,
   readCredentials,
   serverInfoSelect,
   toServerInfo,
} from "@/lib/services/servers";
import { detectProvider } from "@/lib/utils/detect-provider";
import { assertPublicEndpoint } from "@/lib/utils/endpoint";
import { prisma } from "@s3-viewer/db";
import { Permission } from "@s3-viewer/permissions";
import {
   updateCredentialsSchema,
   type UpdateCredentialsInput,
} from "@s3-viewer/types";
import { Router, type Request, type Response } from "express";

const credentialsRouter: Router = Router();

const updateCredentials = async (_req: Request, res: Response) => {
   const { serverId, encryptedCredentials } =
      input<UpdateCredentialsInput>(res);
   const { userId, serverRole } = getAuth(res);
   const credentials = readCredentials(encryptedCredentials);
   await assertPublicEndpoint(credentials.endpoint);

   const current = await prisma.server.findUnique({
      where: { id: serverId },
      select: { allowedBuckets: true },
   });
   if (!current) throw new ApiHttpError(404, SERVER_NOT_FOUND);

   const provider = detectProvider(credentials.endpoint);
   await assertCredentialsWork(
      getS3ClientFromCredentials(credentials, provider),
      current.allowedBuckets,
      "Credential update"
   );

   try {
      const server = await prisma.server.update({
         where: { id: serverId },
         data: { credentials: encryptedCredentials, provider },
         select: serverInfoSelect,
      });
      invalidateS3Client(serverId);
      await recordAudit({
         action: "credentials.update",
         actorId: userId,
         serverId,
      });
      res.json({ server: toServerInfo(server, serverRole) });
   } catch (err) {
      if (isMissingRow(err)) throw new ApiHttpError(404, SERVER_NOT_FOUND);
      throw err;
   }
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
