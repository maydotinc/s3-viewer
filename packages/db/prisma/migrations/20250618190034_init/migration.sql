-- the whole schema in one step. databases that ran the earlier history already carry this
-- migration's name in "_prisma_migrations", so `migrate deploy` treats it as applied and skips
-- the folded-in names it no longer finds on disk (`migrate status` still lists them).
--
-- everything after the foreign keys is hand-written because the Prisma schema cannot express it,
-- so `prisma migrate diff` would not regenerate it; the same goes for the NOT NULL on the two
-- "allowedFolders" arrays and the guarded pg_trgm block. keep them when regenerating this file.

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "AuditLevel" AS ENUM ('ALL', 'CHANGES');

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('S3', 'R2', 'Other');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" "Provider" NOT NULL DEFAULT 'Other',
    "credentials" TEXT NOT NULL,
    "allowedBuckets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "restrictedBuckets" BOOLEAN NOT NULL DEFAULT false,
    "auditEnabled" BOOLEAN NOT NULL DEFAULT false,
    "auditViewRole" "Role" NOT NULL DEFAULT 'OWNER',
    "auditManageRole" "Role" NOT NULL DEFAULT 'OWNER',
    "auditRetentionDays" INTEGER NOT NULL DEFAULT 0,
    "auditLevel" "AuditLevel" NOT NULL DEFAULT 'ALL',
    "capabilities" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "server_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_access" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,

    CONSTRAINT "server_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_invitation" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL DEFAULT replace(((gen_random_uuid())::text || (gen_random_uuid())::text), '-'::text, ''::text),
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "serverId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,

    CONSTRAINT "pending_invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bucket_access" (
    "id" TEXT NOT NULL,
    "bucketName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "restrictedFolders" BOOLEAN NOT NULL DEFAULT false,
    "allowedFolders" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,

    CONSTRAINT "bucket_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation_bucket_access" (
    "id" TEXT NOT NULL,
    "bucketName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "restrictedFolders" BOOLEAN NOT NULL DEFAULT false,
    "allowedFolders" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "invitationId" TEXT NOT NULL,

    CONSTRAINT "invitation_bucket_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "bucket" TEXT,
    "target" TEXT,
    "detail" JSONB,
    "prevHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit" (
    "key" TEXT NOT NULL,
    "hits" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "instance_secret" (
    "name" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instance_secret_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "audit_chain_head" (
    "serverId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "prunedThroughSeq" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_chain_head_pkey" PRIMARY KEY ("serverId")
);

-- CreateTable
CREATE TABLE "archive_ticket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "bytes" INTEGER NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archive_ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bucket_creation" (
    "namespace" TEXT NOT NULL,
    "bucketName" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "submitted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bucket_creation_pkey" PRIMARY KEY ("namespace","bucketName")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "session_expiresAt_idx" ON "session"("expiresAt");

-- CreateIndex
CREATE INDEX "session_createdAt_idx" ON "session"("createdAt");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "account_issuer_accountId_key" ON "account"("issuer", "accountId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "verification_expiresAt_idx" ON "verification"("expiresAt");

-- CreateIndex
CREATE INDEX "server_ownerId_idx" ON "server"("ownerId");

-- CreateIndex
CREATE INDEX "server_name_id_idx" ON "server"("name", "id");

-- CreateIndex
CREATE INDEX "server_access_serverId_createdAt_id_idx" ON "server_access"("serverId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "server_access_userId_serverId_key" ON "server_access"("userId", "serverId");

-- CreateIndex
CREATE UNIQUE INDEX "pending_invitation_token_key" ON "pending_invitation"("token");

-- CreateIndex
CREATE INDEX "pending_invitation_email_createdAt_id_idx" ON "pending_invitation"("email", "createdAt", "id");

-- CreateIndex
CREATE INDEX "pending_invitation_invitedById_createdAt_id_idx" ON "pending_invitation"("invitedById", "createdAt", "id");

-- CreateIndex
CREATE INDEX "pending_invitation_serverId_idx" ON "pending_invitation"("serverId");

-- CreateIndex
CREATE INDEX "pending_invitation_expiresAt_idx" ON "pending_invitation"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "pending_invitation_email_serverId_key" ON "pending_invitation"("email", "serverId");

-- CreateIndex
CREATE INDEX "bucket_access_serverId_idx" ON "bucket_access"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "bucket_access_userId_serverId_bucketName_key" ON "bucket_access"("userId", "serverId", "bucketName");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_bucket_access_invitationId_bucketName_key" ON "invitation_bucket_access"("invitationId", "bucketName");

-- CreateIndex
CREATE INDEX "audit_log_serverId_createdAt_id_idx" ON "audit_log"("serverId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "audit_log_serverId_actorId_createdAt_id_idx" ON "audit_log"("serverId", "actorId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "audit_log_serverId_bucket_createdAt_id_idx" ON "audit_log"("serverId", "bucket", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "audit_log_serverId_action_createdAt_id_idx" ON "audit_log"("serverId", "action", "createdAt" DESC, "id" DESC);

-- CreateIndex
-- the audit search runs an unanchored ILIKE on "target", which only a trigram GIN index can serve.
-- CREATE EXTENSION needs privileges some managed providers withhold from the application role, and
-- a Postgres built without contrib has no pg_trgm at all, so a failure skips the index with a NOTICE
-- instead of failing the migration. a DBA can add it later with:
--   CREATE EXTENSION pg_trgm;
--   CREATE INDEX "audit_log_target_trgm_idx" ON "audit_log" USING gin ("target" gin_trgm_ops);
DO $$
BEGIN
   BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
   EXCEPTION WHEN insufficient_privilege OR feature_not_supported OR undefined_file THEN
      RAISE NOTICE 'pg_trgm extension could not be created (insufficient privilege, or not installed) - skipping trigram index on audit_log.target. Searches on target will continue to sequential-scan. Ask a DBA to run CREATE EXTENSION pg_trgm; then CREATE INDEX "audit_log_target_trgm_idx" ON "audit_log" USING gin ("target" gin_trgm_ops); to enable it later.';
      RETURN;
   END;

   IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
      CREATE INDEX IF NOT EXISTS "audit_log_target_trgm_idx" ON "audit_log" USING gin ("target" gin_trgm_ops);
   END IF;
END
$$;

-- CreateIndex
CREATE UNIQUE INDEX "audit_log_serverId_seq_key" ON "audit_log"("serverId", "seq");

-- CreateIndex
CREATE INDEX "rate_limit_resetAt_idx" ON "rate_limit"("resetAt");

-- CreateIndex
CREATE INDEX "archive_ticket_expiresAt_idx" ON "archive_ticket"("expiresAt");

-- CreateIndex
CREATE INDEX "archive_ticket_userId_createdAt_id_idx" ON "archive_ticket"("userId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "bucket_creation_operation_key" ON "bucket_creation"("operation");

-- CreateIndex
CREATE INDEX "bucket_creation_userId_idx" ON "bucket_creation"("userId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server" ADD CONSTRAINT "server_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_access" ADD CONSTRAINT "server_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_access" ADD CONSTRAINT "server_access_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_invitation" ADD CONSTRAINT "pending_invitation_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_invitation" ADD CONSTRAINT "pending_invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bucket_access" ADD CONSTRAINT "bucket_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bucket_access" ADD CONSTRAINT "bucket_access_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bucket_access" ADD CONSTRAINT "bucket_access_userId_serverId_fkey" FOREIGN KEY ("userId", "serverId") REFERENCES "server_access"("userId", "serverId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_bucket_access" ADD CONSTRAINT "invitation_bucket_access_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "pending_invitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CHECK cannot hold a subquery, so the per-element rule lives in an immutable function. it mirrors
-- grantFolderSchema in packages/shared: every folder ends with "/", never starts with "/", and has
-- no "//" or "." / ".." segment (split on either slash, as hasDotSegment does).
CREATE FUNCTION "grant_folders_valid"(folders text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM unnest(folders) AS f
    WHERE f !~ '/$'
       OR f ~ '^/'
       OR f ~ '//'
       OR f ~ '(^|[/\\])\.{1,2}([/\\]|$)'
  )
$$;

-- a bucket grant can be limited to a set of key prefixes. the flag and the list must agree, so a
-- cleared list never reads as "whole bucket" and a stray list is never ignored. a limited grant is
-- never an admin grant, since admins remove and re-share buckets, which is bucket-wide by nature.
-- no folder is the empty string, which every key starts with. owners reach every bucket implicitly,
-- so an OWNER grant or invite would read as bucket admin.
ALTER TABLE "bucket_access"
  ADD CONSTRAINT "bucket_access_folders_consistent"
    CHECK ("restrictedFolders" = (cardinality("allowedFolders") > 0)),
  ADD CONSTRAINT "bucket_access_folders_role"
    CHECK (NOT "restrictedFolders" OR "role" IN ('VIEWER', 'EDITOR')),
  ADD CONSTRAINT "bucket_access_folders_named"
    CHECK (NOT ('' = ANY("allowedFolders"))),
  ADD CONSTRAINT "bucket_access_folders_shape"
    CHECK ("grant_folders_valid"("allowedFolders")),
  ADD CONSTRAINT "bucket_access_role_not_owner"
    CHECK ("role" <> 'OWNER');

ALTER TABLE "invitation_bucket_access"
  ADD CONSTRAINT "invitation_bucket_access_folders_consistent"
    CHECK ("restrictedFolders" = (cardinality("allowedFolders") > 0)),
  ADD CONSTRAINT "invitation_bucket_access_folders_role"
    CHECK (NOT "restrictedFolders" OR "role" IN ('VIEWER', 'EDITOR')),
  ADD CONSTRAINT "invitation_bucket_access_folders_named"
    CHECK (NOT ('' = ANY("allowedFolders"))),
  ADD CONSTRAINT "invitation_bucket_access_folders_shape"
    CHECK ("grant_folders_valid"("allowedFolders")),
  ADD CONSTRAINT "invitation_bucket_access_role_not_owner"
    CHECK ("role" <> 'OWNER');

ALTER TABLE "pending_invitation"
  ADD CONSTRAINT "pending_invitation_role_not_owner" CHECK ("role" <> 'OWNER');

-- credential replacement authorizes by server.ownerId while everything else reads this row's
-- role, so a server has exactly one owner row. Prisma cannot express a partial index.
CREATE UNIQUE INDEX "server_access_one_owner" ON "server_access"("serverId") WHERE "role" = 'OWNER';

-- every address is lowercased and trimmed before it is stored or compared, so a row written any
-- other way would let one inbox hold two identities; the database refuses it.
ALTER TABLE "user"
  ADD CONSTRAINT "user_email_normalized" CHECK ("email" = lower(btrim("email")));

ALTER TABLE "pending_invitation"
  ADD CONSTRAINT "pending_invitation_email_normalized" CHECK ("email" = lower(btrim("email")));
