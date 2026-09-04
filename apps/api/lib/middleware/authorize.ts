import { MEMBER_NOT_FOUND, SERVER_NOT_FOUND } from "@/lib/constants";
import { ApiHttpError, asyncHandler } from "@/lib/http";
import type { SessionUser } from "@/lib/middleware/auth";
import { input } from "@/lib/middleware/validate";
import { isBucketAllowed } from "@/lib/services/servers";
import { prisma } from "@s3-viewer/db";
import {
   Permission,
   canManageRole,
   effectiveBucketRole,
   hasPermission,
} from "@s3-viewer/permissions";
import { ErrorCode, Role, type UpdateRoleInput } from "@s3-viewer/types";
import type { Request, RequestHandler, Response } from "express";

type AuthContext = {
   userId: string;
   serverRole: Role;
   bucketRole: Role | null;
   targetRole?: Role;
};

const FORBIDDEN = "You don't have permission to do that";

const requireUser = (req: Request): SessionUser => {
   const user = req.user;
   if (!user) throw new ApiHttpError(401, "Sign in to continue");
   return user;
};

const requireVerifiedUser = (req: Request): SessionUser => {
   const user = requireUser(req);
   if (!user.emailVerified) {
      throw new ApiHttpError(
         403,
         "Verify your email address to use invites",
         ErrorCode.EMAIL_UNVERIFIED
      );
   }
   return user;
};

const getAuth = (res: Response): AuthContext => res.locals.auth as AuthContext;

const loadServerRole = async (
   userId: string,
   serverId: string
): Promise<Role> => {
   const access = await prisma.serverAccess.findUnique({
      where: { userId_serverId: { userId, serverId } },
      select: { role: true },
   });
   if (!access) throw new ApiHttpError(404, SERVER_NOT_FOUND);
   return Role[access.role];
};

type ScopeInput = { serverId: string; bucketName?: string };

const authorizeServer = async (
   userId: string,
   serverId: string,
   permission: Permission
): Promise<AuthContext> => {
   const serverRole = await loadServerRole(userId, serverId);
   if (!hasPermission(serverRole, permission)) {
      throw new ApiHttpError(403, FORBIDDEN);
   }
   return { userId, serverRole, bucketRole: null };
};

const authorizeBucket = async (
   userId: string,
   serverId: string,
   bucketName: string,
   permission: Permission
): Promise<AuthContext> => {
   const access = await prisma.serverAccess.findUnique({
      where: { userId_serverId: { userId, serverId } },
      select: {
         role: true,
         server: {
            select: {
               allowedBuckets: true,
               restrictedBuckets: true,
               bucketAccess: {
                  where: { userId, bucketName },
                  select: { role: true },
               },
            },
         },
      },
   });
   if (!access) throw new ApiHttpError(404, SERVER_NOT_FOUND);
   const { bucketAccess, ...scope } = access.server;
   if (!isBucketAllowed(scope, bucketName)) {
      throw new ApiHttpError(404, "Bucket not found");
   }
   const serverRole = Role[access.role];
   const grant = bucketAccess[0];
   const bucketRole = effectiveBucketRole(
      serverRole,
      grant ? Role[grant.role] : null
   );
   if (!hasPermission(bucketRole, permission)) {
      throw new ApiHttpError(403, FORBIDDEN);
   }
   return { userId, serverRole, bucketRole };
};

const authorize = (
   permission: Permission,
   { scope }: { scope: "server" | "bucket" }
): RequestHandler =>
   asyncHandler(async (req, res, next) => {
      const user = requireUser(req);
      const { serverId, bucketName } = input<ScopeInput>(res);
      if (scope === "bucket" && !bucketName) {
         throw new ApiHttpError(
            400,
            "bucketName is required",
            ErrorCode.VALIDATION
         );
      }
      res.locals.auth =
         scope === "bucket" && bucketName
            ? await authorizeBucket(user.id, serverId, bucketName, permission)
            : await authorizeServer(user.id, serverId, permission);
      next();
   });

type MemberActionInput = Pick<UpdateRoleInput, "serverId" | "userId"> &
   Partial<Pick<UpdateRoleInput, "role">>;

const authorizeMemberAction = (): RequestHandler =>
   asyncHandler(async (req, res, next) => {
      const actor = requireUser(req);
      const { serverId, userId, role } = input<MemberActionInput>(res);
      const serverRole = await loadServerRole(actor.id, serverId);
      if (!hasPermission(serverRole, Permission.MANAGE_MEMBERS)) {
         throw new ApiHttpError(403, FORBIDDEN);
      }
      const target = await prisma.serverAccess.findUnique({
         where: { userId_serverId: { userId, serverId } },
         select: { role: true },
      });
      if (!target) throw new ApiHttpError(404, MEMBER_NOT_FOUND);
      const targetRole = Role[target.role];
      if (!canManageRole(serverRole, targetRole)) {
         throw new ApiHttpError(403, "You can't manage that member");
      }
      if (role && !canManageRole(serverRole, Role[role])) {
         throw new ApiHttpError(403, "You can't assign that role");
      }
      res.locals.auth = {
         userId: actor.id,
         serverRole,
         bucketRole: null,
         targetRole,
      };
      next();
   });

export {
   authorize,
   authorizeMemberAction,
   getAuth,
   requireUser,
   requireVerifiedUser,
};
export type { AuthContext };
