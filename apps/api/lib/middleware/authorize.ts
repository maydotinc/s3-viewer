import type { AuditReach } from "@/lib/audit/query";
import { MEMBER_NOT_FOUND, SERVER_NOT_FOUND } from "@/lib/constants";
import { ApiHttpError, asyncHandler } from "@/lib/http";
import type { SessionUser } from "./auth";
import type { CredentialSnapshot } from "@/lib/s3/client-cache";
import { guardFolders, type FolderGrant } from "@/lib/s3/folder-guard";
import { input } from "./validate";
import { grantFoldersOf } from "@/lib/services/bucket-grants";
import { memberRole } from "@/lib/services/members";
import {
   auditScopeOf,
   auditSettingsOf,
   isBucketAllowed,
   type AuditScope,
   type BucketScopeSettings,
} from "@/lib/services/servers";
import { Prisma, type $Enums } from "@prisma/client";
import { prisma } from "@s3-viewer/db";
import {
   Permission,
   auditAccess,
   canManageRole,
   canRemoveAccess,
   effectiveBucketRole,
   hasPermission,
   isAtLeast,
} from "@s3-viewer/permissions";
import {
   ErrorCode,
   Role,
   hasDotSegment,
   isInFolderScope,
   prefixHasDotSegment,
   type AuditEntry,
   type AuditSettings,
   type FolderScope,
} from "@s3-viewer/types";
import type { Request, RequestHandler, Response } from "express";

type AuthContext = {
   userId: string;
   serverId: string;
   serverRole: Role;
   bucketRole: Role | null;
   folders: FolderScope;
   audit: AuditScope;
   bucketScope: BucketScopeSettings;
   credentials?: CredentialSnapshot;
};

const FORBIDDEN = "You don't have permission to do that";

type DenialReason =
   | "forbidden"
   | "bucket"
   | "member"
   | "audit"
   | "folder"
   | "path";
type DenialScope = { serverId: string; actorId: string; audit: AuditScope };
type Denial = DenialScope & {
   entry: AuditEntry & {
      bucket: string | null;
      detail: { permission: string; reason: DenialReason };
   };
};

class AccessDenied extends ApiHttpError {
   constructor(
      status: number,
      message: string,
      public readonly denial: Denial,
      code?: ErrorCode
   ) {
      super(status, message, code);
      this.name = "AccessDenied";
   }
}

const denied = (
   status: number,
   message: string,
   scope: DenialScope,
   permission: string,
   reason: DenialReason,
   bucket: string | null = null
): AccessDenied =>
   new AccessDenied(status, message, {
      ...scope,
      entry: {
         action: "access.denied",
         bucket,
         detail: { permission, reason },
      },
   });

const requireUser = (req: Request): SessionUser => {
   const user = req.user;
   if (!user) throw new ApiHttpError(401, "Sign in to continue");
   return user;
};

const getAuth = (res: Response): AuthContext => {
   const auth = res.locals.auth;
   if (!auth) throw new Error("no authorize gate has run on this route");
   return auth;
};

type ScopeInput = { serverId: string; bucketName?: string };

const denialScope = (auth: AuthContext): DenialScope => ({
   serverId: auth.serverId,
   actorId: auth.userId,
   audit: auth.audit,
});

const denialScopeOf = (res: Response): DenialScope => {
   const { userId, audit } = getAuth(res);
   const { serverId } = input<ScopeInput>(res);
   return { serverId, actorId: userId, audit };
};

const refuse = (
   res: Response,
   permission: string,
   reason: DenialReason,
   message = FORBIDDEN
): AccessDenied => denied(403, message, denialScopeOf(res), permission, reason);

const lockedPermission = async (
   tx: Prisma.TransactionClient,
   res: Response,
   serverId: string,
   permission: Permission,
   message = FORBIDDEN
): Promise<Role> => {
   const role = await memberRole(tx, getAuth(res).userId, serverId);
   if (!role || !hasPermission(role, permission))
      throw refuse(res, permission, "forbidden", message);
   return role;
};

const NAMED_FOLDERS = 3;
const DOT_SEGMENTS =
   "Paths with . or .. segments can only be opened by the server owner.";

const limitedTo = (folders: readonly string[]): string => {
   if (folders.length === 1) {
      return `Your access to this bucket is limited to ${folders[0]}`;
   }
   const named = folders.slice(0, NAMED_FOLDERS).join(", ");
   const more = folders.length - NAMED_FOLDERS;
   return `Your access to this bucket is limited to these folders: ${named}${
      more > 0 ? ` and ${more} more` : ""
   }`;
};

const folderDenial = (
   auth: AuthContext,
   bucketName: string,
   permission: string,
   path: string,
   reason: "folder" | "path"
): AccessDenied =>
   new AccessDenied(
      403,
      reason === "path" ? DOT_SEGMENTS : limitedTo(auth.folders ?? []),
      {
         ...denialScope(auth),
         entry: {
            action: "access.denied",
            bucket: bucketName,
            target: path,
            detail: { permission, reason },
         },
      },
      ErrorCode.FOLDER_ACCESS
   );

const assertInFolders = (
   auth: AuthContext,
   bucketName: string,
   permission: string,
   paths: readonly string[]
): void => {
   if (auth.serverRole === Role.OWNER) return;
   const { folders } = auth;
   const refused = paths.find(
      (path) => hasDotSegment(path) || !isInFolderScope(folders, path)
   );
   if (refused === undefined) return;
   const outside =
      folders !== null &&
      !folders.some((folder) => folder !== "" && refused.startsWith(folder));
   throw folderDenial(
      auth,
      bucketName,
      permission,
      refused,
      outside ? "folder" : "path"
   );
};

const assertListablePrefix = (
   auth: AuthContext,
   bucketName: string,
   permission: string,
   prefix: string
): void => {
   if (auth.serverRole !== Role.OWNER && prefixHasDotSegment(prefix)) {
      throw folderDenial(auth, bucketName, permission, prefix, "path");
   }
};

const guardedGrant = (auth: AuthContext, bucket: string): FolderGrant => ({
   serverId: auth.serverId,
   bucket,
   folders: auth.folders,
   owner: auth.serverRole === Role.OWNER,
});

type MemberAuthority = {
   serverRole: Role | null;
   targetRole: Role | null;
   newRole?: Role | undefined;
   targetBucketRoles?: readonly Role[];
};

const assertMemberAuthority = (
   res: Response,
   { serverRole, targetRole, newRole, targetBucketRoles }: MemberAuthority
): { serverRole: Role; targetRole: Role } => {
   const scope = denialScopeOf(res);
   const refused = (message: string, reason: DenialReason) =>
      denied(403, message, scope, Permission.MANAGE_MEMBERS, reason);
   if (!serverRole || !hasPermission(serverRole, Permission.MANAGE_MEMBERS)) {
      throw refused(FORBIDDEN, "forbidden");
   }
   if (!targetRole) throw new ApiHttpError(404, MEMBER_NOT_FOUND);
   if (!canManageRole(serverRole, targetRole)) {
      throw refused("You can't manage that member", "member");
   }
   if (newRole && !canManageRole(serverRole, newRole)) {
      throw refused("You can't assign that role", "member");
   }
   if (
      targetBucketRoles &&
      !canRemoveAccess(serverRole, targetRole, targetBucketRoles)
   ) {
      throw refused(
         "You can't remove a member with protected bucket access",
         "member"
      );
   }
   return { serverRole, targetRole };
};

type AuditContext = { settings: AuditSettings; reach: AuditReach | null };

const getAuditContext = (res: Response): AuditContext => {
   const audit = res.locals.audit;
   if (!audit) throw new Error("authorizeAudit has not run on this route");
   return audit;
};

type ScopeRow = BucketScopeSettings & {
   serverRole: $Enums.Role;
   auditEnabled: boolean;
   auditLevel: $Enums.AuditLevel;
};

type ServerScopeRow = ScopeRow & CredentialSnapshot;

const SCOPE_COLUMNS = Prisma.sql`a."role" AS "serverRole", s."auditEnabled", s."auditLevel",
   s."allowedBuckets", s."restrictedBuckets"`;
const CREDENTIAL_COLUMNS = Prisma.sql`s."credentials", s."provider", s."ownerId"`;

const scopeRow = async <Row extends ScopeRow>(
   db: Prisma.TransactionClient,
   userId: string,
   serverId: string,
   columns: Prisma.Sql | null,
   join: Prisma.Sql = Prisma.empty
): Promise<Row> => {
   const selected = columns ? [SCOPE_COLUMNS, columns] : [SCOPE_COLUMNS];
   const [row] = await db.$queryRaw<Row[]>`
      SELECT ${Prisma.join(selected, ", ")}
      FROM "server_access" a
      JOIN "server" s ON s."id" = a."serverId"
      ${join}
      WHERE a."userId" = ${userId} AND a."serverId" = ${serverId}`;
   if (!row) throw new ApiHttpError(404, SERVER_NOT_FOUND);
   return row;
};

const contextOf = (
   userId: string,
   serverId: string,
   row: ScopeRow,
   extra: Partial<
      Pick<AuthContext, "bucketRole" | "folders" | "credentials">
   > = {}
): AuthContext => ({
   userId,
   serverId,
   serverRole: Role[row.serverRole],
   bucketRole: null,
   folders: null,
   audit: auditScopeOf(row),
   bucketScope: {
      allowedBuckets: row.allowedBuckets,
      restrictedBuckets: row.restrictedBuckets,
   },
   ...extra,
});

const snapshotOf = ({
   credentials,
   provider,
   ownerId,
}: CredentialSnapshot): CredentialSnapshot => ({
   credentials,
   provider,
   ownerId,
});

const authorizeServer = async (
   userId: string,
   serverId: string,
   permission: Permission,
   db: Prisma.TransactionClient = prisma,
   withCredentials = true
): Promise<AuthContext> => {
   const row = await scopeRow<ScopeRow & Partial<CredentialSnapshot>>(
      db,
      userId,
      serverId,
      withCredentials ? CREDENTIAL_COLUMNS : null
   );
   const auth = contextOf(
      userId,
      serverId,
      row,
      withCredentials ? { credentials: snapshotOf(row as ServerScopeRow) } : {}
   );
   if (!hasPermission(auth.serverRole, permission)) {
      throw denied(403, FORBIDDEN, denialScope(auth), permission, "forbidden");
   }
   return auth;
};

type BucketScopeRow = ServerScopeRow & {
   bucketRole: $Enums.Role | null;
   restrictedFolders: boolean | null;
   allowedFolders: string[] | null;
};

const authorizeBucket = async (
   userId: string,
   serverId: string,
   bucketName: string,
   permission: Permission,
   db: Prisma.TransactionClient = prisma
): Promise<AuthContext> => {
   const row = await scopeRow<BucketScopeRow>(
      db,
      userId,
      serverId,
      Prisma.sql`${CREDENTIAL_COLUMNS}, b."role" AS "bucketRole",
         b."restrictedFolders", b."allowedFolders"`,
      Prisma.sql`LEFT JOIN "bucket_access" b
             ON b."userId" = ${userId}
            AND b."serverId" = ${serverId}
            AND b."bucketName" = ${bucketName}`
   );
   const serverRole = Role[row.serverRole];
   const auth = contextOf(userId, serverId, row, {
      bucketRole: effectiveBucketRole(
         serverRole,
         row.bucketRole ? Role[row.bucketRole] : null
      ),
      folders: serverRole === Role.OWNER ? null : grantFoldersOf(row),
      credentials: snapshotOf(row),
   });
   // a caller with no role answers 404 whether or not the bucket is on the allow-list, so members can't enumerate it.
   if (!auth.bucketRole || !isBucketAllowed(row, bucketName)) {
      // only a name the server already holds reaches the audit trail; any other is whatever the caller typed.
      const known =
         row.bucketRole !== null ||
         (row.restrictedBuckets && row.allowedBuckets.includes(bucketName));
      throw denied(
         404,
         "Bucket not found",
         denialScope(auth),
         permission,
         "bucket",
         known ? bucketName : null
      );
   }
   if (!hasPermission(auth.bucketRole, permission)) {
      throw denied(
         403,
         FORBIDDEN,
         denialScope(auth),
         permission,
         "forbidden",
         bucketName
      );
   }
   return auth;
};

// bucket routes always load credentials; server routes that never reach storage can skip them.
type AuthorizeOptions =
   | { scope: "bucket" }
   | { scope: "server"; credentials?: boolean };

const authorize = (
   permission: Permission,
   options: AuthorizeOptions
): RequestHandler =>
   asyncHandler(async (req, res, next) => {
      const user = requireUser(req);
      const { serverId, bucketName } = input<ScopeInput>(res);
      if (options.scope === "bucket") {
         if (!bucketName) {
            throw new ApiHttpError(
               400,
               "bucketName is required",
               ErrorCode.VALIDATION
            );
         }
         const auth = await authorizeBucket(
            user.id,
            serverId,
            bucketName,
            permission
         );
         res.locals.auth = auth;
         guardFolders([guardedGrant(auth, bucketName)], next);
         return;
      }
      res.locals.auth = await authorizeServer(
         user.id,
         serverId,
         permission,
         prisma,
         options.credentials ?? true
      );
      next();
   });

type AuditSettingsScopeRow = ScopeRow & {
   auditViewRole: $Enums.Role;
   auditManageRole: $Enums.Role;
   auditRetentionDays: number;
   reachBuckets: string[] | null;
   ownBuckets: string[] | null;
};

const reachOf = (
   actorId: string,
   serverRole: Role,
   { reachBuckets, ownBuckets }: AuditSettingsScopeRow
): AuditReach => ({
   buckets: reachBuckets ?? [],
   ownBuckets: ownBuckets ?? [],
   actorId,
   serverWide: isAtLeast(serverRole, Role.ADMIN),
});

const authorizeAudit = (kind: "view" | "manage"): RequestHandler =>
   asyncHandler(async (req, res, next) => {
      const user = requireUser(req);
      const { serverId } = input<ScopeInput>(res);
      const row = await scopeRow<AuditSettingsScopeRow>(
         prisma,
         user.id,
         serverId,
         Prisma.sql`s."auditViewRole", s."auditManageRole", s."auditRetentionDays",
            g."reachBuckets", g."ownBuckets"`,
         Prisma.sql`LEFT JOIN LATERAL (
            SELECT array_agg(b."bucketName")
                      FILTER (WHERE b."restrictedFolders" IS FALSE)
                      AS "reachBuckets",
                   array_agg(b."bucketName")
                      FILTER (WHERE b."restrictedFolders" IS NOT FALSE)
                      AS "ownBuckets"
            FROM "bucket_access" b
            WHERE b."userId" = ${user.id} AND b."serverId" = ${serverId}
         ) g ON TRUE`
      );
      const auth = contextOf(user.id, serverId, row);
      const settings = auditSettingsOf(row);
      const { canView, canManage } = auditAccess(auth.serverRole, settings);
      if (!(kind === "view" ? canView : canManage)) {
         throw denied(
            403,
            FORBIDDEN,
            denialScope(auth),
            `audit.${kind}`,
            "audit"
         );
      }
      res.locals.auth = auth;
      res.locals.audit = {
         settings,
         reach:
            auth.serverRole === Role.OWNER
               ? null
               : reachOf(user.id, auth.serverRole, row),
      } satisfies AuditContext;
      next();
   });

export {
   AccessDenied,
   assertInFolders,
   assertListablePrefix,
   assertMemberAuthority,
   authorize,
   authorizeAudit,
   authorizeBucket,
   authorizeServer,
   denied,
   getAuditContext,
   getAuth,
   guardedGrant,
   lockedPermission,
   refuse,
   requireUser,
};
export type {
   AuditContext,
   AuthContext,
   AuthorizeOptions,
   Denial,
   DenialScope,
};
