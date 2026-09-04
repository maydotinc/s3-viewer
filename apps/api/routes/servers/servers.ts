import { SERVER_NOT_FOUND } from "@/lib/constants";
import { env } from "@/lib/env";
import { ApiHttpError, asyncHandler, noContent } from "@/lib/http";
import { getAuth, requireUser } from "@/lib/middleware/authorize";
import { serverRoute, validatedRoute } from "@/lib/middleware/route";
import { input } from "@/lib/middleware/validate";
import { invalidateS3Client } from "@/lib/s3/client-cache";
import { recordAudit } from "@/lib/services/audit";
import { removeMembership } from "@/lib/services/members";
import {
   exceedsServerCap,
   isMissingRow,
   isUniqueViolation,
   readCredentials,
   serverInfoSelect,
   toServerInfo,
} from "@/lib/services/servers";
import { detectProvider } from "@/lib/utils/detect-provider";
import { assertPublicEndpoint } from "@/lib/utils/endpoint";
import { prisma } from "@s3-viewer/db";
import { MAX_SERVERS_PER_USER } from "@s3-viewer/types";
import { Permission } from "@s3-viewer/permissions";
import {
   Role,
   createServerSchema,
   renameServerSchema,
   serverScope,
   type CreateServerInput,
   type RenameServerInput,
   type ServerScope,
} from "@s3-viewer/types";
import { Router, type Request, type Response } from "express";

const serverCrudRouter: Router = Router();

const DUPLICATE_NAME = "A server with that name already exists";

const listServers = async (req: Request, res: Response) => {
   const user = requireUser(req);
   const rows = await prisma.serverAccess.findMany({
      where: { userId: user.id },
      select: { role: true, server: { select: serverInfoSelect } },
      orderBy: { server: { name: "asc" } },
   });
   res.json({ servers: rows.map((r) => toServerInfo(r.server, Role[r.role])) });
};

const createServer = async (req: Request, res: Response) => {
   const user = requireUser(req);
   const { encryptedCredentials, serverName, bucketNames } =
      input<CreateServerInput>(res);
   const credentials = readCredentials(encryptedCredentials);
   await assertPublicEndpoint(credentials.endpoint);
   const owned = await prisma.server.count({ where: { ownerId: user.id } });
   if (exceedsServerCap(owned)) {
      const contact = env.SUPPORT_EMAIL
         ? ` Contact ${env.SUPPORT_EMAIL} for a higher limit.`
         : "";
      throw new ApiHttpError(
         409,
         `You can create at most ${MAX_SERVERS_PER_USER} servers. Delete one to add another.${contact}`
      );
   }
   try {
      const server = await prisma.server.create({
         data: {
            name: serverName,
            provider: detectProvider(credentials.endpoint),
            credentials: encryptedCredentials,
            allowedBuckets: bucketNames ?? [],
            restrictedBuckets: (bucketNames?.length ?? 0) > 0,
            ownerId: user.id,
            serverAccess: { create: { userId: user.id, role: Role.OWNER } },
         },
         select: serverInfoSelect,
      });
      await recordAudit({
         action: "server.create",
         actorId: user.id,
         serverId: server.id,
         target: server.name,
      });
      res.status(201).json({ server: toServerInfo(server, Role.OWNER) });
   } catch (err) {
      if (isUniqueViolation(err)) throw new ApiHttpError(409, DUPLICATE_NAME);
      throw err;
   }
};

const renameServer = async (_req: Request, res: Response) => {
   const { serverId, serverName } = input<RenameServerInput>(res);
   const { userId, serverRole } = getAuth(res);
   try {
      const server = await prisma.server.update({
         where: { id: serverId },
         data: { name: serverName },
         select: serverInfoSelect,
      });
      await recordAudit({
         action: "server.rename",
         actorId: userId,
         serverId,
         target: server.name,
      });
      res.json({ server: toServerInfo(server, serverRole) });
   } catch (err) {
      if (isUniqueViolation(err)) throw new ApiHttpError(409, DUPLICATE_NAME);
      if (isMissingRow(err)) throw new ApiHttpError(404, SERVER_NOT_FOUND);
      throw err;
   }
};

const deleteServer = async (_req: Request, res: Response) => {
   const { serverId } = input<ServerScope>(res);
   const { userId } = getAuth(res);
   await prisma.server.deleteMany({ where: { id: serverId } });
   invalidateS3Client(serverId);
   await recordAudit({
      action: "server.delete",
      actorId: userId,
      serverId,
   });
   noContent(res);
};

const leaveServer = async (_req: Request, res: Response) => {
   const { serverId } = input<ServerScope>(res);
   const { userId, serverRole } = getAuth(res);
   if (serverRole === Role.OWNER) {
      throw new ApiHttpError(
         400,
         "Owners can't leave. Delete the server instead."
      );
   }
   await removeMembership(userId, serverId);
   await recordAudit({ action: "server.leave", actorId: userId, serverId });
   noContent(res);
};

serverCrudRouter.get("/", asyncHandler(listServers));
serverCrudRouter.post("/", ...validatedRoute(createServerSchema, createServer));
serverCrudRouter.patch(
   "/:serverId",
   ...serverRoute(Permission.RENAME_SERVER, renameServerSchema, renameServer)
);
serverCrudRouter.delete(
   "/:serverId",
   ...serverRoute(Permission.DELETE_SERVER, serverScope, deleteServer)
);
serverCrudRouter.post(
   "/:serverId/leave",
   ...serverRoute(Permission.LIST_BUCKETS, serverScope, leaveServer)
);

export { serverCrudRouter };
