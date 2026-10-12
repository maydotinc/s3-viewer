-- Both dropped indexes are covered by the unique constraints on the same tables:
-- "server_ownerId_name_key" (ownerId, name) and "server_access_userId_serverId_key" (userId, serverId).

-- DropIndex
DROP INDEX "server_ownerId_idx";

-- DropIndex
DROP INDEX "server_access_serverId_userId_idx";

-- CreateIndex
CREATE INDEX "pending_invitation_expiresAt_idx" ON "pending_invitation"("expiresAt");
