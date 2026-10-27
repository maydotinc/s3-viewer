import { env } from "@/lib/env";
import {
   ApiHttpError,
   noContent,
   rethrowDbError,
   serverNotFound,
} from "@/lib/http";
import { LOCK_NAMESPACE, xactLock } from "@/lib/db-locks";
import {
   getAuth,
   lockedPermission,
   requireUser,
} from "@/lib/middleware/authorize";
import { requireFreshSession } from "@/lib/middleware/fresh-session";
import { serverCreateLimit } from "@/lib/middleware/rate-limit";
import { serverRoute, validatedRoute } from "@/lib/middleware/route";
import { invalidateS3Client } from "@/lib/s3/client-cache";
import {
   record,
   recordMany,
   recordWithin,
} from "@/lib/middleware/audit-record";
import { appendAuditWithin } from "@/lib/audit/writer";
import { removeMembership } from "@/lib/services/members";
import {
   auditScopeOf,
   getServerInfo,
   listServerPage,
   lockServerRow,
   openCredentials,
   serverInfoSelect,
   toServerInfo,
} from "@/lib/services/servers";
import { storageCapabilities } from "@/lib/services/storage-capabilities";
import { prisma } from "@s3-viewer/db";
import { Permission } from "@s3-viewer/permissions";
import {
   MAX_SERVERS_PER_USER,
   Role,
   createServerSchema,
   renameServerSchema,
   serverScope,
   serverListQuerySchema,
   type CreateServerInput,
   type RenameServerInput,
   type ServerScope,
} from "@s3-viewer/shared";
import { Router, type Request, type Response } from "express";

const serverCrudRouter: Router = Router();

const listServers = async (
   req: Request,
   res: Response,
   { cursor }: { cursor?: string }
) => {
   const user = requireUser(req);
   res.json(await listServerPage(user.id, cursor));
};

const createServer = async (
   req: Request,
   res: Response,
   input: CreateServerInput
) => {
   const user = requireUser(req);
   const { encryptedCredentials, serverName, bucketNames } = input;
   const { credentials, provider } = await openCredentials(
      encryptedCredentials,
      user.id
   );
   const server = await prisma.$transaction(async (tx) => {
      await xactLock(tx, LOCK_NAMESPACE.SERVER_CREATE, user.id);
      const owned = await tx.server.count({ where: { ownerId: user.id } });
      if (owned >= MAX_SERVERS_PER_USER) {
         const contact = env.SUPPORT_EMAIL
            ? ` Contact ${env.SUPPORT_EMAIL} for a higher limit.`
            : "";
         throw new ApiHttpError(
            409,
            `You can create at most ${MAX_SERVERS_PER_USER} servers. Delete one to add another.${contact}`
         );
      }
      const created = await tx.server.create({
         data: {
            name: serverName,
            provider,
            credentials: encryptedCredentials,
            allowedBuckets: bucketNames ?? [],
            restrictedBuckets: (bucketNames?.length ?? 0) > 0,
            ownerId: user.id,
            serverAccess: { create: { userId: user.id, role: Role.OWNER } },
            capabilities: storageCapabilities(provider, credentials.endpoint),
         },
         select: serverInfoSelect,
      });
      await appendAuditWithin(
         tx,
         {
            serverId: created.id,
            actor: { id: user.id, email: user.email },
         },
         [
            {
               action: "server.create",
               detail: { name: serverName, provider },
            },
         ]
      );
      return created;
   });
   res.status(201).json({ server: toServerInfo(server, Role.OWNER) });
};

const renameServer = async (
   _req: Request,
   res: Response,
   input: RenameServerInput
) => {
   const { serverId, serverName } = input;
   const auth = getAuth(res);
   const { previous, server, serverRole } = await prisma
      .$transaction(async (tx) => {
         const previous = await lockServerRow(tx, serverId, [
            "name",
            "auditEnabled",
            "auditLevel",
         ]);
         auth.audit = auditScopeOf(previous);
         const serverRole = await lockedPermission(
            tx,
            res,
            serverId,
            Permission.RENAME_SERVER
         );
         auth.serverRole = serverRole;
         const server = await tx.server.update({
            where: { id: serverId },
            data: { name: serverName },
            select: serverInfoSelect,
         });
         return { previous, server, serverRole };
      })
      .catch((err: unknown) =>
         rethrowDbError(err, {
            missing: serverNotFound(),
         })
      );
   await record(res, {
      action: "server.rename",
      target: server.name,
      detail: { from: previous.name },
   });
   res.json({ server: toServerInfo(server, serverRole) });
};

const deleteServer = async (
   req: Request,
   res: Response,
   input: ServerScope
) => {
   const { serverId } = input;
   requireFreshSession(req, "deleting a server");
   // the row lock comes first so this serializes with audit settings changes. the audit rows outlive the server and maintenance purges them after the retention floor.
   await prisma.$transaction(async (tx) => {
      const { name } = await lockServerRow(tx, serverId, ["name"]);
      await tx.server.deleteMany({ where: { id: serverId } });
      await recordWithin(tx, res, {
         action: "server.delete",
         detail: { name },
      });
   });
   invalidateS3Client(serverId);
   noContent(res);
};

const leaveServer = async (
   _req: Request,
   res: Response,
   input: ServerScope
) => {
   const { serverId } = input;
   const { userId, serverRole } = getAuth(res);
   if (serverRole === Role.OWNER) {
      throw new ApiHttpError(
         400,
         "Owners can't leave. Delete the server instead."
      );
   }
   const { revokedInvites } = await removeMembership(userId, serverId);
   await recordMany(res, [{ action: "server.leave" }, ...revokedInvites]);
   noContent(res);
};

serverCrudRouter.get(
   "/",
   ...validatedRoute(serverListQuerySchema, listServers)
);
serverCrudRouter.get(
   "/:serverId",
   ...validatedRoute(serverScope, async (req, res, { serverId }) => {
      res.json({ server: await getServerInfo(requireUser(req).id, serverId) });
   })
);
serverCrudRouter.post(
   "/",
   serverCreateLimit,
   ...validatedRoute(createServerSchema, createServer)
);
serverCrudRouter.patch(
   "/:serverId",
   ...serverRoute(Permission.RENAME_SERVER, renameServerSchema, renameServer, {
      credentials: false,
   })
);
serverCrudRouter.delete(
   "/:serverId",
   ...serverRoute(Permission.DELETE_SERVER, serverScope, deleteServer, {
      credentials: false,
   })
);
serverCrudRouter.post(
   "/:serverId/leave",
   ...serverRoute(Permission.LIST_BUCKETS, serverScope, leaveServer, {
      credentials: false,
   })
);

export { serverCrudRouter };
