import type { AuditReach } from "@/lib/audit/query";
import { ApiHttpError, asyncHandler, serverNotFound } from "@/lib/http";
import {
   AccessDeniedError,
   FORBIDDEN,
   denied,
   folderDenial,
   type DenialReason,
   type DenialScope,
} from "./access-denied";
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
   effectiveBucketRole,
   hasPermission,
} from "@s3-viewer/permissions";
import {
   ErrorCode,
   Role,
   hasDotSegment,
   isInFolderScope,
   prefixHasDotSegment,
   type AuditSettings,
   type FolderScope,
} from "@s3-viewer/shared";
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

const requireUser = (req: Request): SessionUser => {
   const user = req.user;
   if (!user) throw new ApiHttpError(401, "Sign in required");
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
): AccessDeniedError =>
   denied(403, message, denialScopeOf(res), permission, reason);

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
      denialScope(auth),
      folders,
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
      throw folderDenial(
         denialScope(auth),
         auth.folders,
         bucketName,
         permission,
         prefix,
         "path"
      );
   }
};

const guardedGrant = (auth: AuthContext, bucket: string): FolderGrant => ({
   serverId: auth.serverId,
   bucket,
   folders: auth.folders,
   owner: auth.serverRole === Role.OWNER,
});

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
   if (!row) throw serverNotFound();
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
   serverRole: row.serverRole,
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
   withCredentials = true
): Promise<AuthContext> => {
   const row = await scopeRow<ScopeRow & Partial<CredentialSnapshot>>(
      prisma,
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
   const serverRole = row.serverRole;
   const auth = contextOf(userId, serverId, row, {
      bucketRole: effectiveBucketRole(serverRole, row.bucketRole ?? null),
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
   serverWide: boolean,
   { reachBuckets, ownBuckets }: AuditSettingsScopeRow
): AuditReach => ({
   buckets: reachBuckets ?? [],
   ownBuckets: ownBuckets ?? [],
   actorId,
   serverWide,
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
      const { canView, canManage, canVerify } = auditAccess(
         auth.serverRole,
         settings
      );
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
               : reachOf(user.id, canVerify, row),
      } satisfies AuditContext;
      next();
   });

export {
   assertInFolders,
   assertListablePrefix,
   authorize,
   authorizeAudit,
   authorizeBucket,
   authorizeServer,
   denialScopeOf,
   getAuditContext,
   getAuth,
   guardedGrant,
   lockedPermission,
   refuse,
   requireUser,
};
export type { AuditContext, AuthContext, AuthorizeOptions };
